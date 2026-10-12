// La capienza del trattamento integrativo, mese per mese: sul PROGRESSIVO.
//
// Sotto i 15.000 il trattamento spetta solo se c'è IRPEF da compensare:
// imposta lorda oltre la detrazione da lavoro meno 75 € (DL 3/2020, art. 1).
// Per un po' l'app lo verificava sul solo mese (lordo × 12), e un mese a metà
// da 534 € perdeva il trattamento anche dopo nove mesi pieni. Il programma
// paghe ragiona sul progressivo dell'anno: la capienza costruita fino a quel
// mese. E a inizio anno, senza progressivo, il datore lo eroga e smette dopo,
// se serve: il conto vero lo fa il conguaglio.
//
// Quindi la base è la MEDIA dei mesi dell'anno con un lordo (compreso questo),
// riportata a dodici mesi; il primo mese lo concede. La soglia dei 1.250 € al
// mese resta sul mese (check-ti-mensile): è un'altra regola, verificata.
//
// Indicato da chi mantiene il progetto, NON ancora riscontrato su una busta:
// serve un mese basso dopo mesi pieni. → check-ti-capienza.mjs

import { redditoComplessivo, irpefLorda, detrazioneLavoro, nettoDelMese } from './net.js';
import { fiscoDi } from './fisco/index.js';
import { programmaPaghe } from './programmi-paghe/index.js';

/**
 * @param {number} lordoMese lordo del mese
 * @param {object} settings
 * @param {{lordo:number, mesi:number, mese?:number}|null} progressivo lordo e
 *   numero dei mesi dell'anno PRIMA di questo, e l'indice 0-11 di questo (da
 *   `progressiviDellAnno` in conguaglio.js)
 * @returns {{capiente:boolean, media:number|null, lordoPresunto:number|null}}
 *   `media` è il lordo mensile su cui si è deciso, `null` il primo mese,
 *   concesso senza conti; `lordoPresunto` da `lordoPresuntoAnno`.
 */
export function capienzaProgressiva(lordoMese, settings = {}, progressivo = null) {
  const mesi = Number(progressivo?.mesi) || 0;
  const lordoPresunto = lordoPresuntoAnno(lordoMese, settings, progressivo);
  if (mesi === 0 && programmaPaghe(settings).primoMeseConcesso) return { capiente: true, media: null, lordoPresunto };
  const media = ((Number(progressivo.lordo) || 0) + (Number(lordoMese) || 0)) / (mesi + 1);
  const reddito = redditoComplessivo(media * 12, settings);
  return {
    capiente: irpefLorda(reddito, fiscoDi(settings)) > detrazioneLavoro(reddito, fiscoDi(settings)) - fiscoDi(settings).TI_CAPIENZA_SCONTO,
    media: Math.round(media * 100) / 100,
    lordoPresunto,
  };
}

/**
 * Il LORDO PRESUNTO dell'anno, su cui il datore decide ogni mese trattamento
 * integrativo e detrazioni. Come lo stima dipende dal programma paghe: la
 * regola sta nel suo file in `programmi-paghe/`.
 *
 * @returns {number|null} `null` senza l'indice del mese: si torna a lordo × 12.
 */
export function lordoPresuntoAnno(lordoMese, settings = {}, progressivo = null) {
  return programmaPaghe(settings).lordoPresuntoAnno(lordoMese, settings, progressivo);
}

/**
 * Il netto del mese col tratt. integrativo FORZATO presente o assente: la
 * simulazione del suo riquadro nel netto (NetPillole.jsx). Cambia SOLO quella
 * riga: forzare la decisione mensile spostava anche la fascia delle detrazioni
 * (`riferimentoAnnuoDelMese`), e il netto si muoveva di 119 € per un
 * trattamento di 102. La quota è quella che la busta stampa: 1.200 € sui
 * giorni del mese, troncata. → check-ti-capienza.mjs
 */
export function nettoSimulandoTi(lordoMese, settings, giorniMese, extraMese, capienza, presente) {
  return simulaTi(nettoDelMese(lordoMese, settings, giorniMese, extraMese, capienza), giorniMese, presente, settings);
}

/** Lo stesso, partendo da un netto già calcolato (anche col premio di risultato). */
export function simulaTi(vero, giorniMese, presente, impostazioni = {}) {
  const T = fiscoDi(impostazioni);
  const quota = presente ? programmaPaghe(impostazioni).quota(T.TI_MASSIMO * (giorniMese / 365)) : 0;
  const delta = quota - vero.trattamentoIntegrativo;
  return {
    ...vero,
    trattamentoIntegrativo: quota,
    bonus: Math.round((vero.bonus + delta) * 100) / 100,
    net: Math.round((vero.net + delta) * 100) / 100,
  };
}
