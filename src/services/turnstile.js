// Turnstile invisibile: prova al proxy che dall'altra parte c'è un browser vero.
//
// È l'unica difesa seria contro uno script che ha decompilato l'app e conosce
// l'URL del proxy: i tetti di volume limitano il danno, questo lo previene.
// Per chi usa l'app è trasparente — nessun quadratino da spuntare, nessuna
// immagine da riconoscere.
//
// Il token si chiede SOLO al momento dell'import, non all'avvio: caricare lo
// script di Cloudflare a ogni apertura peserebbe su chi non usa mai l'import,
// e i token scadono comunque dopo pochi minuti.

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Oltre questo tempo si rinuncia: meglio un errore leggibile che un pulsante
// bloccato per sempre su "Analisi in corso".
const TIMEOUT_MS = 20000;

export const turnstileAttivo = () => !!SITEKEY;

let caricamento = null;

function caricaScript() {
  if (window.turnstile) return Promise.resolve();
  if (caricamento) return caricamento;
  caricamento = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      caricamento = null; // un fallimento di rete non deve avvelenare i tentativi successivi
      reject(new Error('script non caricato'));
    };
    document.head.appendChild(s);
  });
  return caricamento;
}

/**
 * Ottiene un token di verifica. Restituisce '' se Turnstile non è configurato
 * (sviluppo locale senza sitekey), così il flusso resta identico.
 *
 * Il contenitore è un div fuori schermo: in modalità invisibile Turnstile non
 * disegna nulla di visibile, ma un elemento nel DOM gli serve comunque.
 */
export async function ottieniToken() {
  if (!SITEKEY) return '';
  await caricaScript();

  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
  document.body.appendChild(box);

  let widgetId;
  try {
    return await new Promise((resolve, reject) => {
      const scaduto = setTimeout(() => reject(new Error('verifica scaduta')), TIMEOUT_MS);
      const chiudi = (fn) => (arg) => { clearTimeout(scaduto); fn(arg); };
      widgetId = window.turnstile.render(box, {
        sitekey: SITEKEY,
        appearance: 'interaction-only',
        callback: chiudi(resolve),
        'error-callback': chiudi(() => reject(new Error('verifica fallita'))),
        'timeout-callback': chiudi(() => reject(new Error('verifica scaduta'))),
      });
    });
  } finally {
    // Il widget va sempre rimosso: senza, ogni import lascerebbe in pagina un
    // iframe di Cloudflare che continua a rinnovare il token.
    try { if (widgetId !== undefined) window.turnstile.remove(widgetId); } catch { /* già rimosso */ }
    box.remove();
  }
}
