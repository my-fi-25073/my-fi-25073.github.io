import { lstat, readdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WARNING_BYTES = 800_000_000;
export const LIMIT_BYTES = 1_000_000_000;
export const SOURCE_EXCLUDES = new Set(['.astro', '.git', 'dist', 'node_modules']);

export async function measureDirectory(directory, { excludeRootNames = new Set() } = {}) {
  const root = resolve(directory);
  const rootStat = await lstat(root).catch((error) => {
    if (error?.code === 'ENOENT') {
      throw new Error(`Required directory does not exist: ${root}`);
    }
    throw error;
  });

  if (!rootStat.isDirectory()) {
    throw new Error(`Expected a directory: ${root}`);
  }

  let bytes = 0;
  let files = 0;

  async function visit(current, isRoot = false) {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (isRoot && excludeRootNames.has(entry.name)) continue;

      const entryPath = resolve(current, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in the measured tree: ${entryPath}`);
      }

      if (entry.isFile()) {
        const entryStat = await lstat(entryPath);
        bytes += entryStat.size;
        files += 1;
      }
    }
  }

  await visit(root, true);
  return { bytes, files };
}

export function classifySize(
  bytes,
  warningBytes = WARNING_BYTES,
  limitBytes = LIMIT_BYTES,
  { hardLimit = true } = {},
) {
  if (bytes >= limitBytes) return hardLimit ? 'limit' : 'warning';
  if (bytes >= warningBytes) return 'warning';
  return 'ok';
}

export function formatBytes(bytes) {
  if (bytes < 1_024) return `${bytes} B`;

  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unit = 'B';

  for (const nextUnit of units) {
    value /= 1_024;
    unit = nextUnit;
    if (value < 1_024 || nextUnit === units.at(-1)) break;
  }

  return `${value.toFixed(2)} ${unit}`;
}

export function formatReport(
  label,
  measurement,
  {
    warningBytes = WARNING_BYTES,
    limitBytes = LIMIT_BYTES,
    hardLimit = true,
  } = {},
) {
  const status = classifySize(measurement.bytes, warningBytes, limitBytes, { hardLimit });
  const statusLabel = status === 'ok' ? 'OK' : status === 'warning' ? 'WARNING' : 'LIMIT EXCEEDED';
  const percentage = ((measurement.bytes / limitBytes) * 100).toFixed(3);

  return `${label}: ${formatBytes(measurement.bytes)} across ${measurement.files} files (${percentage}% of limit) — ${statusLabel}`;
}

export async function runSizeCheck(
  projectRoot,
  {
    warningBytes = WARNING_BYTES,
    limitBytes = LIMIT_BYTES,
    logger = console,
  } = {},
) {
  const source = await measureDirectory(projectRoot, { excludeRootNames: SOURCE_EXCLUDES });
  const builtSite = await measureDirectory(resolve(projectRoot, 'dist'));
  const reports = [
    { label: 'Public source working tree', ...source, hardLimit: false },
    { label: 'Built site (dist)', ...builtSite, hardLimit: true },
  ];

  const gitDirectory = resolve(projectRoot, '.git');
  const gitStat = await lstat(gitDirectory).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (gitStat?.isDirectory()) {
    const gitStorage = await measureDirectory(gitDirectory);
    reports.splice(1, 0, {
      label: 'Local Git storage (.git)',
      ...gitStorage,
      hardLimit: false,
    });
  }

  logger.log(
    `Size budget: warning at ${formatBytes(warningBytes)}; published-site fail at ${formatBytes(limitBytes)}.`,
  );
  for (const report of reports) {
    logger.log(formatReport(report.label, report, {
      warningBytes,
      limitBytes,
      hardLimit: report.hardLimit,
    }));
  }

  if (classifySize(builtSite.bytes, warningBytes, limitBytes) === 'limit') {
    throw new Error('GitHub Pages size budget exceeded. Move published media to external storage before deploying.');
  }

  if (reports.some((report) => (
    classifySize(report.bytes, warningBytes, limitBytes, { hardLimit: report.hardLimit }) === 'warning'
  ))) {
    logger.warn('Size warning: plan the external media-storage migration before adding more images.');
  }

  return reports;
}

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(modulePath), '..');
const invokedPath = process.argv[1]
  ? await realpath(resolve(process.argv[1])).catch(() => resolve(process.argv[1]))
  : null;
const canonicalModulePath = await realpath(modulePath);

if (invokedPath === canonicalModulePath) {
  runSizeCheck(projectRoot).catch((error) => {
    console.error(`Size check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
