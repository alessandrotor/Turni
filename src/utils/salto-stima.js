// «La stima è salita di 910 € senza turni nuovi»: quando la previsione di
// dicembre si sposta molto e chi usa l'app non ha toccato niente, lo si dice.
// Novembre 2026: un aggiornamento ha cambiato il conto del mese in corso nella
// stima «dal maturato», e il riquadro è passato da «ancora ~55 ore» a «oltre
// la soglia» da un giorno all'altro, senza una parola.
//
// Per accorgersene bisogna ricordare la stima di prima: si tiene l'ULTIMA
// stima calcolata con la sua impronta (turni e impostazioni). Non è un «l'ho
// già visto» su chi usa l'app: è lo stato dei dati, e l'avviso nasce da lì.
// Regola pura qui, memoria in RiquadroTI.jsx. → check-salto-stima.mjs

/** Dove si ricorda, per anno: { [anno]: { fotografia, salto } }. */
export const KEY_STIMA = 'turni_stima_ricordata';

/** Sotto questa cifra uno spostamento è rumore (arrotondamenti, giorni). */
export const SALTO_MINIMO = 250;
/** Per quanti giorni l'avviso resta, se nel frattempo non si toccano i turni. */
export const GIORNI_AVVISO = 7;

const giorno = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

/**
 * @typedef {{ valore: number, turni: string, impostazioni: string, giorno: number }} Fotografia
 * @typedef {{ da: number, a: number, giorno: number, turni: string, causa: 'impostazioni'|'calcolo' }} Salto
 */

/**
 * Confronta la stima di adesso con quella ricordata.
 * @param {{ precedente?: Fotografia|null, salto?: Salto|null, valore: number, turni: string, impostazioni: string, oggi: Date }} p
 * @returns {{ fotografia: Fotografia, salto: Salto|null }} cosa ricordare, e l'avviso da mostrare (o nessuno)
 */
export function confrontaStima({ precedente = null, salto = null, valore, turni, impostazioni, oggi }) {
  const g = giorno(oggi);
  const fotografia = { valore, turni, impostazioni, giorno: g };
  let nuovo = salto;
  if (precedente && precedente.turni === turni) {
    const delta = valore - precedente.valore;
    if (Math.abs(delta) >= SALTO_MINIMO) {
      nuovo = {
        // Un salto dopo un altro allunga quello: «da» resta il punto di partenza.
        da: salto && salto.turni === turni && g - salto.giorno <= GIORNI_AVVISO ? salto.da : precedente.valore,
        a: valore, giorno: g, turni,
        causa: precedente.impostazioni === impostazioni ? 'calcolo' : 'impostazioni',
      };
    }
  }
  // Turni nuovi spiegano da soli lo spostamento; l'avviso scade dopo una settimana.
  if (nuovo && (nuovo.turni !== turni || g - nuovo.giorno > GIORNI_AVVISO || Math.abs(nuovo.a - nuovo.da) < SALTO_MINIMO)) nuovo = null;
  return { fotografia, salto: nuovo };
}
