const CACHE='pcb-techdesk-v2-2-3-shell-6';
const SHELL=['./','./index.html','./login.html','./app.html','./reports.html','./assets/styles.css','./assets/config.js','./assets/db.js','./assets/utils.js','./assets/public.js','./assets/staff-ui.js','./assets/staff.js','./assets/app.js','./assets/reports.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});
