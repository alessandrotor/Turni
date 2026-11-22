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
import { tipoTurno, TIPO } from './assenze.js';
import { calcShiftMinutes, getRateForDate } from './pay.js';

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

/**
 * I permessi rimasti, divisi per ANNO DI MATURAZIONE: ognuno ha la sua
 * scadenza, e quelli non goduti entro `pagatiEntro` (fine settembre dell'anno
 * dopo, nel Turismo) vengono pagati invece che goduti. È la domanda vera: quali
 * ore devo usare, ed entro quando, se non voglio che me le liquidino?
 *
 * Il punto di partenza è la riga «Permessi» di una busta (Residuo AP, Maturato,
 * Goduto, Saldo). Le ore godute consumano prima le più vecchie, quindi il
 * residuo dell'anno prima si riduce per primo. Da lì in poi: si aggiungono i
 * ratei dei mesi seguenti fino a `oggi` e si tolgono i permessi segnati nel
 * calendario dopo la busta (anche quelli futuri: sono già decisi). I lotti già
 * scaduti a `oggi` si dicono `pagati`.
 *
 * @param {{ busta: { anno: number, mese: number, residuo?: number, maturato?: number, goduto?: number, saldo: number },
 *   turni?: Array<any>, settings?: Impostazioni, oggi: Date }} p
 * @returns {{ lotti: Array<{ anno: number, ore: number, godereEntro: string, pagatiEntro: string }>,
 *   pagati: Array<{ anno: number, ore: number }>, totale: number } | null}
 */
export function lottiPermessi({ busta, turni = [], settings = {}, oggi }) {
  if (!regolePermessi(settings) || !busta || !(busta.anno > 0)) return null;
  const r2 = (n) => Math.round(n * 100) / 100;
  const residuo = Number(busta.residuo) || 0;
  const goduto = Number(busta.goduto) || 0;
  const lotti = new Map();
  if (busta.maturato == null) {
    // Solo il saldo (scritto a mano senza il resto della riga): tutto sull'anno della busta.
    lotti.set(busta.anno, Number(busta.saldo) || 0);
  } else {
    lotti.set(busta.anno - 1, Math.max(0, residuo - goduto));
    lotti.set(busta.anno, (Number(busta.maturato) || 0) - Math.max(0, goduto - residuo));
  }
  // I ratei dei mesi dopo la busta, fino al mese di oggi.
  const fine = oggi.getFullYear() * 12 + oggi.getMonth() + 1;
  for (let k = busta.anno * 12 + busta.mese + 1; k <= fine; k++) {
    const a = Math.floor((k - 1) / 12), m = ((k - 1) % 12) + 1;
    const rateo = (maturatoPermessi(a, m, settings) || 0) - (m > 1 ? maturatoPermessi(a, m - 1, settings) || 0 : 0);
    lotti.set(a, (lotti.get(a) || 0) + rateo);
  }
  // I permessi segnati dopo la busta consumano prima i lotti più vecchi.
  const dopo = `${busta.anno}-${String(busta.mese).padStart(2, '0')}-31`;
  let usati = (turni || []).filter((t) => tipoTurno(t) === TIPO.PERMESSO && t.date > dopo)
    .reduce((s, t) => s + calcShiftMinutes(t) / 60, 0);
  for (const a of [...lotti.keys()].sort((x, y) => x - y)) {
    const tolti = Math.min(lotti.get(a), usati);
    lotti.set(a, lotti.get(a) - tolti); usati -= tolti;
  }
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ora = iso(oggi);
  const vivi = [], pagati = [];
  for (const a of [...lotti.keys()].sort((x, y) => x - y)) {
    const ore = r2(lotti.get(a));
    if (ore <= 0) continue;
    const sc = scadenzePermessi(a, settings);
    if (sc.pagatiEntro < ora) pagati.push({ anno: a, ore });
    else vivi.push({ anno: a, ore, ...sc });
  }
  return { lotti: vivi, pagati, totale: r2(vivi.reduce((s, l) => s + l.ore, 0)) };
}

/** Quanto vale in lordo un lotto se viene pagato invece che goduto (alla paga di quel giorno). */
export function valorePermessi(ore, quando, settings = {}) {
  return Math.round((Number(ore) || 0) * getRateForDate(quando, settings) * 100) / 100;
}
