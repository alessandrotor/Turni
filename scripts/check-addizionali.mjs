// Quando scattano le addizionali regionale e comunale — e perché sono un
// GRADINO, non una curva.
//
//   node scripts/check-addizionali.mjs
//
// PERCHÉ ESISTE
// Il motore ha una riga (`addDovute` in net.js) che decide se le addizionali si
// pagano: «solo se resta imposta netta, e allora sull'intero imponibile». È una
// regola tutto-o-niente, e produce il salto più grosso di tutta la curva del
// netto: un euro di imponibile in più, e si pagano 215 € che prima non c'erano.
// Quella riga non l'aveva mai toccata nessun riscontro.
//
// La scansione del netto annuo euro per euro (19 settembre 2026) ha trovato tre
// buche, non una: 8.500, 15.000 e 35.000 di imponibile. Quella a 8.500 vale
// 152 € per chi non paga addizionali e 367 € per chi le paga — più del triplo
// della buca dei 15.000 di cui l'app avvisa — ed è in pieno nella fascia di chi
// usa Turni. Due terzi di quei 367 € sono addizionali.
//
// DA DOVE VIENE IL FATTO, visto che NON viene da una busta
// Le addizionali sono dovute se, per lo stesso anno, risulta dovuta l'IRPEF
// al netto delle detrazioni: art. 50 c. 2 D.Lgs. 446/1997 (regionale) e art. 1
// c. 4 D.Lgs. 360/1998 (comunale). La base è il reddito complessivo, non
// l'eccedenza oltre la soglia — da qui il gradino.
//
// **Nessuno dei cinque cedolini nel repository può confermarlo**: quel datore
// manda le addizionali a conguaglio e in busta sono zero (`addRegionalePct: 0`
// in tutti i check-busta-*). Questo riscontro fissa la NORMA e il
// comportamento del motore, non un dato osservato. Se un domani arriva un
// cedolino che le trattiene, vince il cedolino.
//
// DOVE SI ROMPE: se cambiano la detrazione da lavoro o la prima aliquota
// IRPEF, il punto in cui scattano si sposta e il primo controllo fallisce. È
// il punto: è lì che l'avviso sulla buca andrebbe rifatto.

import { calcNetAnnual, redditoComplessivo, TAX_2026 } from '../src/utils/net.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

// Profilo che le addizionali le paga davvero: è l'unico su cui la regola si
// vede. Gli altri check usano lo 0 perché copiano le buste di riferimento.
const S = {
  ccnl: 'commercio', expectedWeeklyHours: 40, hourlyRate: 9.5,
  overtimeSurchargePct: 30, aziendaDipendenti: 'oltre15',
  addRegionalePct: 1.73, addComunalePct: 0.8,
};
const ALIQUOTA_ADD = (S.addRegionalePct + S.addComunalePct) / 100;

// Lordo che produce un dato imponibile, per bisezione: la conversione non è
// lineare (ci stanno in mezzo i contributi) e fissarla a mano la farebbe
// scollare dal motore al primo cambio di aliquota contributiva.
const lordoPerImponibile = (target) => {
  let lo = 0;
  let hi = 60000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (redditoComplessivo(mid, S) <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

// ── 1. Il punto in cui scattano è la no tax area ─────────────────────────────
console.log('');
console.log('Dove scattano: la no tax area del lavoro dipendente');
console.log('');

// Sotto la no tax area l'imposta lorda non supera la detrazione, quindi non
// resta imposta netta. Il confine è detrazione ÷ prima aliquota, e con i
// parametri 2026 fa esattamente 8.500.
const NO_TAX_AREA = TAX_2026.DETR_LAV_FISSA / TAX_2026.IRPEF_SCAGLIONI[0].aliquota;
esito(NO_TAX_AREA === 8500,
  'la no tax area è detrazione ÷ prima aliquota',
  `${TAX_2026.DETR_LAV_FISSA} ÷ ${TAX_2026.IRPEF_SCAGLIONI[0].aliquota} = ${NO_TAX_AREA}`);

const sotto = calcNetAnnual(lordoPerImponibile(NO_TAX_AREA - 1), S);
const sopra = calcNetAnnual(lordoPerImponibile(NO_TAX_AREA + 1), S);

esito(sotto.irpefNetta === 0 && sotto.addRegionale === 0 && sotto.addComunale === 0,
  'sotto la no tax area non si paga nulla',
  `imponibile ${sotto.imponibile.toFixed(0)}: imposta netta 0, addizionali 0`);
esito(sopra.irpefNetta > 0 && sopra.addRegionale + sopra.addComunale > 0,
  'appena sopra, imposta netta e addizionali ci sono entrambe',
  `imponibile ${sopra.imponibile.toFixed(0)}: netta ${sopra.irpefNetta.toFixed(2)}, addizionali ${(sopra.addRegionale + sopra.addComunale).toFixed(2)}`);

// ── 2. È un gradino, e quanto è alto ─────────────────────────────────────────
console.log('');
console.log('Non una curva: si pagano sull’INTERO imponibile, di colpo');
console.log('');

const saltoAdd = (sopra.addRegionale + sopra.addComunale) - (sotto.addRegionale + sotto.addComunale);

// L'affermazione che rende la cosa un problema: bastano pochi centesimi di
// imposta netta per far comparire centinaia di euro di addizionali.
esito(sopra.irpefNetta < 1 && saltoAdd > 200,
  'centesimi di imposta netta fanno scattare centinaia di euro',
  `imposta netta ${sopra.irpefNetta.toFixed(2)} → addizionali ${saltoAdd.toFixed(2)}`);
esito(Math.abs(saltoAdd - sopra.imponibile * ALIQUOTA_ADD) < 1,
  'la base è tutto l’imponibile, non l’eccedenza oltre la soglia',
  `${sopra.imponibile.toFixed(0)} × ${(ALIQUOTA_ADD * 100).toFixed(2)}% = ${(sopra.imponibile * ALIQUOTA_ADD).toFixed(2)}`);
// Se fossero calcolate sull'eccedenza, il salto sarebbe di due centesimi.
esito(saltoAdd > 100 * (2 * ALIQUOTA_ADD),
  'sull’eccedenza il salto non esisterebbe: è l’intero imponibile a fare il gradino');

// ── 3. La buca che ne nasce ──────────────────────────────────────────────────
console.log('');
console.log('La buca a 8.500, e quanto ne sono addizionali');
console.log('');

// Il netto CALA superando la no tax area: guadagnare un euro in più lascia con
// meno soldi in tasca. È il difetto che l'app non segnala ancora.
esito(sopra.net < sotto.net,
  'superata la no tax area il netto SCENDE',
  `${sotto.net.toFixed(0)} → ${sopra.net.toFixed(0)} (−${(sotto.net - sopra.net).toFixed(0)} €)`);

// L'altra metà del gradino è lo scalino del cuneo (7,1% → 5,3%), che cade
// esattamente nello stesso punto: la L. 207/2024 ha messo il confine di fascia
// sulla no tax area. Le due cose insieme fanno la buca.
esito(TAX_2026.CUNEO_PCT_1_SOGLIA === NO_TAX_AREA,
  'il cuneo cambia fascia ESATTAMENTE lì, non per caso',
  `soglia cuneo ${TAX_2026.CUNEO_PCT_1_SOGLIA} = no tax area ${NO_TAX_AREA}`);
const saltoCuneo = sotto.bonusCuneo - sopra.bonusCuneo;
esito(saltoCuneo > 100 && saltoAdd > saltoCuneo,
  'le addizionali pesano più del cuneo',
  `addizionali ${saltoAdd.toFixed(0)} € contro cuneo ${saltoCuneo.toFixed(0)} €`);

// Chi le addizionali non le paga (primo anno di lavoro, o trattenute altrove)
// cade lo stesso nella buca, ma da un'altra altezza: è il motivo per cui
// l'avviso, quando si farà, deve leggere la cifra dal motore e non scriverla.
const SENZA = { ...S, addizionaliAltrove: true };
const cadutaSenza = calcNetAnnual(lordoPerImponibile(NO_TAX_AREA - 1), SENZA).net
  - calcNetAnnual(lordoPerImponibile(NO_TAX_AREA + 1), SENZA).net;
esito(cadutaSenza > 0 && cadutaSenza < (sotto.net - sopra.net),
  'senza addizionali la buca resta, ma molto meno profonda',
  `${cadutaSenza.toFixed(0)} € contro ${(sotto.net - sopra.net).toFixed(0)} €`);

// ── 4. Gli interruttori dell'utente vincono sulla regola ─────────────────────
console.log('');
console.log('Chi non le deve pagare non le paga');
console.log('');

const g = lordoPerImponibile(NO_TAX_AREA + 1);
for (const [nome, extra] of [
  ['trattenute da un altro datore', { addizionaliAltrove: true }],
  ['primo anno di lavoro', { noAddizionali: true }],
]) {
  const v = calcNetAnnual(g, { ...S, ...extra });
  esito(v.addRegionale === 0 && v.addComunale === 0, `${nome}: nessuna addizionale`);
}

console.log(`\n${falliti === 0 ? '✓ la regola delle addizionali regge' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
