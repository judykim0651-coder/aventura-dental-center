import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';
const REPO='/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/aventura-dental-html-wireframe';
const CT={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);let f=u==='/'?'index.html':(u.startsWith('/services/')?'SERVICES/'+u.slice(10)+'.html':u.slice(1));let fp=path.join(REPO,f);if(!fs.existsSync(fp)){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':CT[path.extname(fp)]||'application/octet-stream'});res.end(fs.readFileSync(fp));});
await new Promise(r=>server.listen(0,r));const port=server.address().port;
const b=await chromium.launch();const p=await b.newPage();
await p.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'}).catch(()=>{});
await p.waitForTimeout(2200); // let count-up finish
const nums=await p.$$eval('.stat-item__number',els=>els.map(e=>e.textContent.trim()));
const labels=await p.$$eval('.stat-item__label',els=>els.map(e=>e.textContent.trim()));
console.log('rendered stats (JS on):',nums.map((n,i)=>`${n} ${labels[i]||''}`).join(' | '));
await b.close();server.close();
