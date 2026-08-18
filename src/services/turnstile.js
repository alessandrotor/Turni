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

// Un solo giro di giostra: disegna il widget, aspetta il token, pulisce.
async function unTentativo() {
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
        // Il CODICE d'errore va conservato, non buttato. Il 18 agosto un
        // «110200» (dominio non in elenco) è costato un'ora di diagnosi
        // perché a video arrivava solo «verifica non riuscita»: il codice
        // dice in un secondo se è configurazione, rete o blocco del browser.
        'error-callback': chiudi((codice) => {
          console.warn('turnstile: errore', codice);
          reject(new Error(`verifica fallita (${codice ?? 'senza codice'})`));
        }),
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

/**
 * Ottiene un token di verifica. Restituisce '' se Turnstile non è configurato
 * (sviluppo locale senza sitekey), così il flusso resta identico.
 *
 * Riprova UNA volta prima di arrendersi. Non è prudenza generica: il primo
 * tentativo fallisce in casi che al secondo non si ripresentano — la
 * configurazione del widget appena cambiata e non ancora propagata ai bordi di
 * Cloudflare, lo script caricato ma non ancora pronto, un singolo pacchetto
 * perso. Senza il secondo tentativo ognuno di questi costa all'utente l'intero
 * import: deve chiudere l'errore e riscegliere la foto da capo.
 */
export async function ottieniToken() {
  if (!SITEKEY) return '';
  await caricaScript();

  try {
    return await unTentativo();
  } catch (primo) {
    console.warn('turnstile: primo tentativo fallito, riprovo —', primo.message);
    // Mezzo secondo di respiro: senza pausa un guasto istantaneo (script non
    // pronto) si ripeterebbe identico.
    await new Promise(r => setTimeout(r, 500));
    return unTentativo();
  }
}
