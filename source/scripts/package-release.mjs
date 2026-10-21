import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import JSZip from 'jszip';
const zip=new JSZip(),pkg=JSON.parse(await readFile('package.json','utf8')),manifest=JSON.parse(await readFile('dist/offline-manifest.json','utf8'));
for(const entry of [...manifest.assets,{url:'sw.js'},{url:'offline-manifest.json'}])zip.file('site/'+entry.url,await readFile(path.join('dist',entry.url)));
async function include(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await include(p);else zip.file('source/'+p.replaceAll('\\','/'),await readFile(p));}}
for(const dir of ['src','public','docs','tests'])await include(dir);
for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md'])zip.file('source/'+file,await readFile(file));
for(const file of ['build-offline.mjs','service-worker.js','prepare-symbol-assets.mjs','patch-symbol-search.mjs','preview-server.mjs','package-release.mjs'])zip.file('source/scripts/'+file,await readFile('scripts/'+file));
zip.file('先读我.txt','site内全部内容放入新仓库docs/目录，source为完整源码。Pages选择main分支、/docs。不要双击index.html以file://运行，请使用HTTPS发布地址或localhost预览。程序包不包含患者记录或QA测评导出文件。\r\n');
const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await mkdir('交付',{recursive:true});
const filename=`交付/符号搜索六试次平台_${pkg.version}.zip`;await writeFile(filename,buffer);
const receipt={version:pkg.version,buildId:manifest.buildId,path:filename,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),siteFiles:manifest.assets.length+2,patientDataIncluded:false};
await writeFile('qa/package-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
