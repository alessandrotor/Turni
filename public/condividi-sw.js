// «Condividi → Turni»: riceve quello che Android manda all'app installata
// (share_target nel manifest, vite.config.js). È una POST: una pagina non la
// può leggere, il service worker sì. Workbox lo carica PRIMA delle sue regole
// (`importScripts`), quindi questa risposta arriva per prima.
//
// Immagine e testo restano in una cache del telefono e la pagina li apre con
// `?immagine_condivisa` o `?testo_condiviso` (ImportTesto.jsx li legge e li
// cancella). Il testo NON va nell'indirizzo: l'indirizzo lo legge anche il
// contatore visite. → check-configurazione.mjs
//
// Se qualcosa va storto si apre comunque l'app, invece di una pagina d'errore.
const IMMAGINE = 'immagine_condivisa';
const TESTO = 'testo_condiviso';

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'POST' || url.pathname !== '/condividi') return;
  evento.respondWith((async () => {
    try {
      const dati = await evento.request.formData();
      const cache = await caches.open('turni-condivisi');
      const immagine = dati.getAll('immagini').find((f) => f && f.size);
      if (immagine) {
        await cache.put('/condiviso/immagine', new Response(immagine, { headers: { 'Content-Type': immagine.type || 'image/jpeg' } }));
        return Response.redirect(`/?${IMMAGINE}=1`, 303);
      }
      const testo = ['titolo', 'testo', 'link'].map((campo) => dati.get(campo)).filter(Boolean).join('\n');
      if (!testo) return Response.redirect('/', 303);
      await cache.put('/condiviso/testo', new Response(testo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      return Response.redirect(`/?${TESTO}=1`, 303);
    } catch {
      return Response.redirect('/', 303);
    }
  })());
});
