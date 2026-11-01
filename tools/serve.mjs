import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.mobileconfig':'application/x-apple-aspen-config'};
createServer(async(req,res)=>{
  try{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';
    const target=path.resolve(root,'.'+name);if(!target.startsWith(root+path.sep))throw Error('Invalid path');
    const content=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(5188,'127.0.0.1',()=>console.log('KiocVoca: http://127.0.0.1:5188/'));
