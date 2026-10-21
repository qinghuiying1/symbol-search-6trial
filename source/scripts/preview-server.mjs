import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist'),port=Number(process.env.SYMBOL_PREVIEW_PORT||4176),prefix='/symbol-search-6trial/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.ttf':'font/ttf'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let relative=decodeURIComponent(url.pathname);if(relative.startsWith(prefix))relative=relative.slice(prefix.length);else relative=relative.replace(/^\//,'');if(!relative||relative.endsWith('/'))relative+='index.html';const p=path.resolve(root,relative);if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}await stat(p);res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(await readFile(p));}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Preview http://localhost:${port}${prefix}`));
