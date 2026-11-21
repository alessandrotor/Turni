// I permessi retribuiti (ROL ed ex festività): quanti se ne maturano e quando
// scadono. Le regole stanno nel contratto (`permessiRol` in contratti/), qui
// si fanno solo i conti.
//
// Si matura un dodicesimo delle ore annue per ogni mese in cui si è stati in
// forza almeno 15 giorni (la frazione sotto i 15 non conta). Le ore annue
// dipendono dall'anzianità per chi è assunto dopo `gradualeDal`, e sono
// riproporzionate al part-time sulle ore settimanali.
// Riscontrato sulle buste di settembre e ottobre 2026 (Turismo, part-time 60%,
// assunzione a fine dicembre 2025): «Permessi maturato» 14,40 e 16,00 ore.
// → scripts/check-busta-permessi-2026.mjs

import { getCcnl } from './ccnl.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

const giorniNelMese = (anno, mese) => new Date(anno, mese, 0).getDate();

/** Le regole dei permessi del contratto, o null se il contratto non ne ha. */
export function regolePermessi(settings = {}) {
  return getCcnl(settings.ccnl).permessiRol || null;
}

/** Ore annue a tempo pieno con `mesi` mesi di anzianità compiuti. */
function oreAnnueTempoPieno(regole, mesi, assunzione) {
  if (!assunzione || !regole.gradini || assunzione < regole.gradualeDal) return regole.oreTempoPieno;
  let ore = regole.gradini[0][1];
  for (const [daMesi, o] of regole.gradini) if (mesi >= daMesi) ore = o;
  return ore;
}

/**
 * Ore di permesso maturate nell'anno, da gennaio a `finoAMese` compreso.
 * @param {number} anno
 * @param {number} finoAMese 1–12
 * @param {Impostazioni} settings `ccnl`, `hireDate`, `expectedWeeklyHours`, `fullTimeWeeklyHours`
 * @returns {number|null} ore (due decimali), o null se il contratto non ha permessi
 */
export function maturatoPermessi(anno, finoAMese, settings = {}) {
  const regole = regolePermessi(settings);
  if (!regole) return null;
  const tempoPieno = Number(settings.fullTimeWeeklyHours) || 40;
  const ore = Number(settings.expectedWeeklyHours);
  const quota = ore > 0 ? Math.min(1, ore / tempoPieno) : 1;
  const assunzione = settings.hireDate || '';
  const [ha, hm, hg] = assunzione ? assunzione.split('-').map(Number) : [0, 0, 0];
  let totale = 0;
  for (let m = 1; m <= finoAMese; m++) {
    let giorni = giorniNelMese(anno, m);
    if (assunzione) {
      const prima = ha * 12 + hm, questo = anno * 12 + m;
      if (questo < prima) continue;
      if (questo === prima) giorni = giorniNelMese(anno, m) - hg + 1;
    }
    if (giorni < 15) continue;
    // Mesi di anzianità COMPIUTI all'inizio di questo mese: il 25° mese ne ha 24.
    const mesi = assunzione ? anno * 12 + m - (ha * 12 + hm) - 1 : Infinity;
    totale += oreAnnueTempoPieno(regole, mesi, assunzione) * quota / 12;
  }
  return Math.round(totale * 100) / 100;
}

/** Entro quando godere i permessi maturati nell'`anno`, e quando si pagano se non goduti. */
export function scadenzePermessi(anno, settings = {}) {
  const regole = regolePermessi(settings);
  if (!regole) return null;
  return { godereEntro: `${anno + 1}-${regole.godereEntro}`, pagatiEntro: `${anno + 1}-${regole.pagatiEntro}` };
}
