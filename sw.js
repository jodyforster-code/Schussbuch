const C='schussbuch-v461-match-results',A=['./','index.html','manifest.webmanifest','icons/ipsc-logo.png','vendor/jszip.min.js','authority.js','match-results.js','expenses.js','app-update.js','vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','vendor/DejaVuSans.ttf'];
const staticURLs=new Set(A.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(C).then(cache=>cache.addAll(A)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // Previous versions accidentally cached API responses. Remove those caches.
    for(const key of await caches.keys()){
      if(key.startsWith('schussbuch-')&&key!==C)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // No interception or caching of Supabase, authentication, or third-party requests.
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const navigation=request.mode==='navigate';
  if(!navigation&&!staticURLs.has(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(C);
    try{
      const response=await fetch(request,{cache:'no-cache'});
      if(response.ok){
        try{await cache.put(navigation?new URL('index.html',self.registration.scope).href:request,response.clone())}catch{}
      }
      return response;
    }catch(error){
      const saved=await cache.match(navigation?new URL('index.html',self.registration.scope).href:request);
      if(saved)return saved;
      throw error;
    }
  })());
});
