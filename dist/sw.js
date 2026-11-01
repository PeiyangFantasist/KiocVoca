const CACHE='kiocvoca-f8caffe43723';
const FILES=['./','./index.html','./ui-a2d0eef3a4.css','./main-a2d0eef3a4.js','./scheduler-a2d0eef3a4.js','./words-a2d0eef3a4.json','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./KiocVoca.mobileconfig'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const path of FILES){
    const request=new Request(new URL(path,self.location),{cache:'reload',credentials:'same-origin'});
    const response=await fetch(request);
    if(!response.ok||new URL(response.url).origin!==self.location.origin)throw Error('Offline cache needs an authenticated response');
    if(path==='./index.html' && !(await response.clone().text()).includes('<title>KiocVoca'))throw Error('Not the application document');
    if(path==='./words-a2d0eef3a4.json' && !(await response.clone().json()).words?.length)throw Error('Not the vocabulary data');
    await cache.put(request,response);
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('kiocvoca-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>await (await caches.open(CACHE)).match(new URL('./index.html',self.location))||new Response('首次使用请先联网。',{headers:{'content-type':'text/plain;charset=utf-8'}})));
  }else{
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE),hit=await cache.match(event.request,{ignoreSearch:true});
      return hit||fetch(event.request);
    })());
  }
});
