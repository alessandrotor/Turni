// «Condividi → Turni»: riceve quello che Android manda all'app installata
// (share_target nel manifest, vite.config.js). È una POST: una pagina non la
// può leggere, il service worker sì. Workbox lo carica PRIMA delle sue regole
// (`importScripts`), quindi questa risposta arriva per prima.
//
// - Un'immagine resta in una cache del telefono e la pagina la apre con
//   `?immagine_condivisa` (ImportTesto.jsx la legge e la cancella). Non va da
//   nessuna parte: né al sito, né ad altri.
// - Un testo torna nei parametri che «Incolla turni» legge già.
//
// I nomi dei campi sono un contratto col manifest: → check-configurazione.mjs
const IMMAGINE = 'immagine_condivisa';

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'POST' || url.pathname !== '/condividi') return;
  evento.respondWith((async () => {
    const dati = await evento.request.formData();
    const immagine = dati.getAll('immagini').find((f) => f && f.size);
    if (immagine) {
      const cache = await caches.open('turni-condivisi');
      await cache.put('/condiviso/immagine', new Response(immagine, { headers: { 'Content-Type': immagine.type || 'image/jpeg' } }));
      return Response.redirect(`/?${IMMAGINE}=1`, 303);
    }
    const q = new URLSearchParams();
    for (const [campo, parametro] of [['titolo', 'titolo_condiviso'], ['testo', 'testo_condiviso'], ['link', 'link_condiviso']]) {
      const v = dati.get(campo);
      if (v) q.set(parametro, v);
    }
    return Response.redirect(`/?${q}`, 303);
  })());
});
