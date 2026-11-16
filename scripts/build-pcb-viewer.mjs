import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const result=await build({
  entryPoints:[resolve(root,'public/ui/pcb/viewer.mjs')],bundle:true,format:'esm',minify:true,
  supported:{'template-literal':false},write:false,
});
// Shader strings are escaped by the compiler above; trim only generated line
// endings while retaining bundled third-party license notices.
writeFileSync(resolve(root,'public/ui/pcb/viewer.bundle.mjs'),result.outputFiles[0].text.replace(/[\t ]+$/gm,''));
