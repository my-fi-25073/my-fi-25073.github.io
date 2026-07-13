import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  LIMIT_BYTES,
  WARNING_BYTES,
  classifySize,
  formatBytes,
  measureDirectory,
  runSizeCheck,
} from '../scripts/check-size.mjs';

test('measureDirectory counts nested files and ignores excluded directory names', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'keylog-size-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, 'public', 'media'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'dependency'), { recursive: true });
  await writeFile(join(root, 'README.md'), '12345');
  await writeFile(join(root, 'public', 'media', 'photo.avif'), '1234567');
  await writeFile(join(root, 'node_modules', 'dependency', 'large.bin'), '123456789');

  const measurement = await measureDirectory(root, {
    excludeRootNames: new Set(['node_modules']),
  });

  assert.deepEqual(measurement, { bytes: 12, files: 2 });
});

test('measureDirectory only applies exclusions at the measured root', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'keylog-size-root-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, 'content', 'dist'), { recursive: true });
  await writeFile(join(root, 'content', 'dist', 'kept.txt'), '1234');

  const measurement = await measureDirectory(root, {
    excludeRootNames: new Set(['dist']),
  });

  assert.deepEqual(measurement, { bytes: 4, files: 1 });
});

test('classifySize uses an early warning and a hard limit', () => {
  assert.equal(classifySize(WARNING_BYTES - 1), 'ok');
  assert.equal(classifySize(WARNING_BYTES), 'warning');
  assert.equal(classifySize(LIMIT_BYTES - 1), 'warning');
  assert.equal(classifySize(LIMIT_BYTES), 'limit');
  assert.equal(classifySize(LIMIT_BYTES, WARNING_BYTES, LIMIT_BYTES, { hardLimit: false }), 'warning');
});

test('formatBytes keeps reports readable at small and large sizes', () => {
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(1_024), '1.00 KiB');
  assert.equal(formatBytes(1_048_576), '1.00 MiB');
});

test('runSizeCheck warns without failing before the published-site limit', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'keylog-size-warning-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'source.txt'), '123456');
  await writeFile(join(root, 'dist', 'index.html'), '123456');

  const logs = [];
  const warnings = [];
  const reports = await runSizeCheck(root, {
    warningBytes: 5,
    limitBytes: 10,
    logger: {
      log: (message) => logs.push(message),
      warn: (message) => warnings.push(message),
    },
  });

  assert.equal(reports.length, 2);
  assert.equal(warnings.length, 1);
  assert.match(logs.at(-1), /Built site \(dist\).*WARNING/);
});

test('runSizeCheck rejects a published site at the hard limit', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'keylog-size-limit-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist', 'index.html'), '1234567890');

  await assert.rejects(
    runSizeCheck(root, {
      warningBytes: 5,
      limitBytes: 10,
      logger: { log: () => {}, warn: () => {} },
    }),
    /GitHub Pages size budget exceeded/,
  );
});

test('measureDirectory rejects symbolic links', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'keylog-size-link-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'target.txt'), 'target');
  await symlink(join(root, 'target.txt'), join(root, 'link.txt'));

  await assert.rejects(measureDirectory(root), /Symbolic links are not allowed/);
});
