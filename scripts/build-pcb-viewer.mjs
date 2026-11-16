import { build } from 'esbuild';
import { readFileSync,writeFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const result=await build({
  entryPoints:[resolve(root,'public/ui/pcb/viewer.mjs')],bundle:true,format:'esm',minify:true,
  supported:{'template-literal':false},write:false,
});
// Shader strings are escaped by the compiler above; trim only generated line
// endings while retaining bundled third-party license notices.
const output=result.outputFiles[0].text.replace(/[\t ]+$/gm,''),directory=resolve(root,'public/ui/pcb');
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,16);
writeFileSync(resolve(directory,'viewer.bundle.mjs'),output);
const html=readFileSync(resolve(directory,'index.html'),'utf8')
  .replace(/src="\.\/viewer\.bundle\.mjs(?:\?v=[a-f0-9]+)?"/g,`src="./viewer.bundle.mjs?v=${digest(output)}"`)
  .replace(/href="\.\/viewer\.css(?:\?v=[a-f0-9]+)?"/g,`href="./viewer.css?v=${digest(readFileSync(resolve(directory,'viewer.css')))}"`);
writeFileSync(resolve(directory,'index.html'),html);
writeFileSync(resolve(directory,'version.mjs'),`export const pcbViewerVersion=${JSON.stringify(digest(html))};\n`);
