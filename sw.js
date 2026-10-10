// MediaBrief service worker: TXT stale-while-revalidate, fonts cache-first, HTML network-first.
const V='mb-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 const font=u.pathname.includes('/fonts/')||u.hostname==='cdn.jsdelivr.net',txt=u.pathname.includes('/txt/'),
   page=r.mode==='navigate';if(!font&&!txt&&!page)return;
 e.respondWith(caches.open(V).then(async c=>{const hit=await c.match(r,{ignoreSearch:page});
  const net=fetch(r).then(x=>{if(x.ok||x.type==='opaque')c.put(r,x.clone());return x});
  if(font&&hit)return hit;
  if(txt&&hit){e.waitUntil(net.catch(()=>{}));return hit}
  return net.catch(()=>hit||Response.error())}))});
