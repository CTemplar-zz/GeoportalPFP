const VERSION='__VERSION__';
const SHELL=VERSION+'-shell';
const DATA=VERSION+'-data';
const precache=__PRECACHE__;
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(precache))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('pfp-mobile-')&&!key.startsWith(VERSION))await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||req.headers.has('Range'))return;
  // Do not cache third-party basemaps or tile archives. Only own app/data resources.
  if(!/\.(html|js|css|json|geojson|png|svg|woff2|webmanifest|pdf|xlsx)$/.test(url.pathname)&&req.mode!=='navigate')return;
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try{const response=await fetch(req);if(response.ok){const cache=await caches.open(DATA);await cache.put(req,response.clone());}return response;}
    catch{if(req.mode==='navigate')return caches.match(new URL('index.html',self.registration.scope));return new Response('Recurso no disponible sin conexión',{status:503});}
  })());
});
