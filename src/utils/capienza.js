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

import { redditoComplessivo, irpefLorda, detrazioneLavoro, nettoDelMese, TAX_2026 } from './net.js';

/**
 * @param {number} lordoMese lordo del mese
 * @param {object} settings
 * @param {{lordo:number, mesi:number}|null} progressivo lordo e numero dei mesi
 *   dell'anno PRIMA di questo (da `progressiviDellAnno` in conguaglio.js)
 * @returns {{capiente:boolean, media:number|null}} `media` è il lordo mensile
 *   su cui si è deciso; `null` il primo mese, concesso senza conti.
 */
export function capienzaProgressiva(lordoMese, settings = {}, progressivo = null) {
  const mesi = Number(progressivo?.mesi) || 0;
  if (mesi === 0) return { capiente: true, media: null };
  const media = ((Number(progressivo.lordo) || 0) + (Number(lordoMese) || 0)) / (mesi + 1);
  const reddito = redditoComplessivo(media * 12, settings);
  return {
    capiente: irpefLorda(reddito) > detrazioneLavoro(reddito) - TAX_2026.TI_CAPIENZA_SCONTO,
    media: Math.round(media * 100) / 100,
  };
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
  const vero = nettoDelMese(lordoMese, settings, giorniMese, extraMese, capienza);
  const quota = presente ? Math.floor(TAX_2026.TI_MASSIMO * (giorniMese / 365) * 100) / 100 : 0;
  const delta = quota - vero.trattamentoIntegrativo;
  return {
    ...vero,
    trattamentoIntegrativo: quota,
    bonus: Math.round((vero.bonus + delta) * 100) / 100,
    net: Math.round((vero.net + delta) * 100) / 100,
  };
}
