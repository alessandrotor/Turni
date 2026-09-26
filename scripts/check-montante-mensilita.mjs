// Riscontro del montante davanti alle mensilita' aggiuntive:
//
//   node scripts/check-montante-mensilita.mjs
//
// DA DOVE NASCE
// Segnalato il 22 settembre 2026 da una schermata Statistiche che non tornava:
// montante 9.060 € fermato a «tutto luglio 2026», assunzione 29/12/2025,
// quindi 14ª maturata 6/12 ed erogata a GIUGNO. La 14ª stava dentro i 9.060 —
// il progressivo del cedolino di luglio la comprende — e l'app la sommava
// un'altra volta.
//
// IL DANNO ERA DOPPIO, E IL SECONDO PESAVA PIU' DEL PRIMO
//   1. «Maturato finora» gonfiato di mezza mensilita' (+476 €).
//   2. La 14ª finita dentro il montante NON veniva dichiarata in `extras`.
//      `projectAnnualIncome` sottrae le una-tantum prima di annualizzare
//      proprio perche' non vadano moltiplicate per 12/mesi-trascorsi: una
//      quota dichiarata per difetto le fa passare per reddito ricorrente.
//      A settembre il fattore e' 12/9, quindi +634 € sulla stima di fine anno.
//   Misurato sul caso reale: 12.137 € invece di 11.661, stima 17.736 invece
//   di 17.102.
//
// LA PROPRIETA' CHE CONTA
// Dove passa il confine del montante non deve cambiare il risultato. Due
// persone con lo STESSO reddito reale — una che ferma il montante a maggio e
// lascia che sia l'app ad aggiungere la 14ª, una che lo ferma a luglio e ce
// l'ha gia' dentro — devono leggere lo stesso maturato e la stessa stima. E'
// l'unica formulazione che non dipende da quale delle due strade e' «giusta»:
// sono entrambe lecite, e il pannello deve reggerle tutte e due.
//
// PERCHE' L'ANNO PASSATO
// Su un anno concluso `receivedExtraMonthsCount` guarda dicembre, quindi 13ª e
// 14ª risultano entrambe erogate qualunque sia il giorno in cui gira lo
// script. Sull'anno in corso lo stesso caso sarebbe muto da gennaio a maggio,
// quando la 14ª non e' ancora arrivata: il riscontro girerebbe verde senza
// provare niente per meta' anno.

import { computeAnnualGrossFromShifts, projectAnnualIncome, monthlyBaseGross, extraMonthAccrual } from '../src/utils/net.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(50)} atteso ${String(atteso).padStart(8)} → ${String(avuto).padStart(8)}  ${perche}`);
}

const arr = (n) => Math.round(n);

const ANNO = new Date().getFullYear();
const PASSATO = ANNO - 1;
const MESE = new Date().getMonth() + 1;

// Part-time 60% CCNL Turismo, come la busta di riferimento. Assunzione vecchia
// di anni: qui si prova DOVE cade il confine del montante, e un rateo parziale
// mescolerebbe due domande in un numero solo. Il rateo ha la sua prova a parte,
// in fondo, sul caso reale da cui e' partita la segnalazione.
const S = {
  hourlyRate: 10, expectedWeeklyHours: 24, workingDaysPerWeek: 6, ccnl: 'turismo',
  hasTredicesima: true, hasQuattordicesima: true, hireDate: `${PASSATO - 3}-01-01`,
};
const MENSILE = monthlyBaseGross(S);

// Mesi di erogazione: 14ª a giugno (indice 5), 13ª a dicembre (indice 11).
const MONTANTE = 9060;
const conMontante = (mese, importo = MONTANTE, anno = PASSATO) => ({
  ...S, priorTaxableIncome: importo, priorIncomeDate: `${anno}-${String(mese).padStart(2, '0')}-01`,
});

console.log(`\nMensilita' base ${arr(MENSILE)} €/mese · anno concluso ${PASSATO} · oggi mese ${MESE}\n`);

// ── 1. Il montante non si fa risommare cio' che contiene gia' ──────────────
console.log('Il montante non si fa risommare le mensilita che contiene\n');

const aMaggio = computeAnnualGrossFromShifts(PASSATO, [], conMontante(5));
const aLuglio = computeAnnualGrossFromShifts(PASSATO, [], conMontante(7));

// Montante fermato a maggio: la 14ª di giugno NON c'e' dentro, va aggiunta,
// insieme alla 13ª di dicembre. Due mensilita' intere.
verifica('montante a maggio → aggiunge 14ª e 13ª',
  arr(aMaggio.total - MONTANTE), arr(2 * MENSILE), 'nessuna delle due e nel montante');

// Montante fermato a luglio: la 14ª c'e' gia', resta da aggiungere la sola 13ª.
verifica('montante a luglio → aggiunge solo la 13ª',
  arr(aLuglio.total - MONTANTE), arr(MENSILE), 'la 14ª di giugno e gia dentro');

// Il caso che falliva: prima della correzione qui uscivano due mensilita'
// anche a luglio, cioe' la 14ª contata due volte.
verifica('  la 14ª non e contata due volte',
  arr(aLuglio.total), arr(MONTANTE + MENSILE), 'era MONTANTE + 2 mensilita');

// ── 2. `extras` descrive il contenuto di `total`, non cio' che somma ───────
console.log('\n`extras` dichiara le una-tantum dentro `total`\n');

// E' il contratto su cui si regge projectAnnualIncome: tutto cio' che e'
// una-tantum va dichiarato, comunque sia entrato nel totale. Su un anno
// concluso sono sempre due mensilita' piene, ovunque cada il confine.
verifica('montante a maggio → extras = 2 mensilita', arr(aMaggio.extras), arr(2 * MENSILE), '');
verifica('montante a luglio → extras = 2 mensilita', arr(aLuglio.extras), arr(2 * MENSILE),
  'anche la meta che sta dentro il montante');

// Mese del montante oltre dicembre non esiste, ma oltre OGGI si': il selettore
// in Impostazioni e' un <input type="month"> senza tetto. Chi riporta a ottobre
// un progressivo di dicembre ha un montante che contiene piu' mensilita' di
// quante ne risultino incassate — e il montante fa fede per il suo periodo.
const aDicembre = computeAnnualGrossFromShifts(PASSATO, [], conMontante(12));
verifica('montante a dicembre → non aggiunge nulla', arr(aDicembre.total), MONTANTE, 'le ha gia tutte');
verifica('  e le dichiara comunque', arr(aDicembre.extras), arr(2 * MENSILE), '');

// ── 3. La proprieta' che conta: il confine non sposta il risultato ─────────
console.log('\nDove cade il confine del montante non cambia il risultato\n');

// Stesso reddito reale, due modi leciti di dichiararlo. Chi ferma il montante
// a luglio deve scriverci dentro anche la 14ª: e' quello che fa il progressivo
// del cedolino.
const primaDella14 = computeAnnualGrossFromShifts(PASSATO, [], conMontante(5, MONTANTE));
const dopoLa14 = computeAnnualGrossFromShifts(PASSATO, [], conMontante(7, MONTANTE + MENSILE));

verifica('stesso reddito, confine diverso → stesso maturato',
  arr(primaDella14.total), arr(dopoLa14.total), 'maggio+app contro luglio-gia-dentro');
verifica('  e stesse una-tantum dichiarate',
  arr(primaDella14.extras), arr(dopoLa14.extras), '');
verifica('  e stessa stima di fine anno',
  arr(projectAnnualIncome(primaDella14.total, primaDella14.extras, S, PASSATO).value),
  arr(projectAnnualIncome(dopoLa14.total, dopoLa14.extras, S, PASSATO).value), '');

// ── 4. Quanto costava l'errore: l'annualizzazione ──────────────────────────
//
// Il secondo punto del difetto vive solo dove la stima ANNUALIZZA, cioe' in
// modalita' `ytd` (e per il lavoro a chiamata). La previsione in avanti —
// quella di default — somma i mesi che restano invece di moltiplicare il
// passato, quindi non moltiplica niente: e' il motivo per cui il difetto si e'
// visto sul pannello di chi aveva scelto `ytd` e non altrove.
//
// Serve inoltre l'anno IN CORSO, dove `monthsElapsed` e' minore di 12. Da
// gennaio a maggio la 14ª non e' ancora erogata e non c'e' niente da provare:
// il riscontro lo dice, invece di fingere di aver verificato.
console.log('\nIn modalita ytd l annualizzazione non moltiplica le mensilita\n');

if (MESE > 6) {
  const YTD = { ...S, tiProjectionMode: 'ytd' };
  // Quanto vale la 14ª di quest'anno: chi ferma il montante a luglio ce l'ha
  // dentro, e per confrontare due dichiarazioni dello STESSO reddito va
  // aggiunta al montante, non inventata.
  const quota14 = MENSILE * extraMonthAccrual('quattordicesima', ANNO, S);
  const sMaggio = { ...YTD, priorTaxableIncome: MONTANTE, priorIncomeDate: `${ANNO}-05-01` };
  const sLuglio = { ...YTD, priorTaxableIncome: MONTANTE + quota14, priorIncomeDate: `${ANNO}-07-01` };
  const rMaggio = computeAnnualGrossFromShifts(ANNO, [], sMaggio);
  const rLuglio = computeAnnualGrossFromShifts(ANNO, [], sLuglio);

  verifica('ytd: stesso reddito, confine diverso → stesso maturato',
    arr(rMaggio.total), arr(rLuglio.total), '');

  const stimaM = projectAnnualIncome(rMaggio.total, rMaggio.extras, sMaggio, ANNO).value;
  const stimaL = projectAnnualIncome(rLuglio.total, rLuglio.extras, sLuglio, ANNO).value;
  verifica('  e stessa stima di fine anno', arr(stimaM), arr(stimaL),
    `il fattore in gioco e 12/${MESE}`);

  // La prova diretta del danno evitato: non dichiarare la mensilita' la fa
  // passare per reddito ricorrente, e la stima si gonfia del moltiplicatore.
  const senzaDichiarare = projectAnnualIncome(rLuglio.total, 0, sLuglio, ANNO).value;
  verifica('  non dichiararla la gonfia', senzaDichiarare > stimaL, true,
    `+${arr(senzaDichiarare - stimaL)} € sulla stima`);
} else {
  console.log(`  --  siamo al mese ${MESE}: la 14ª non e ancora erogata, niente da provare qui`);
}

// ── 5. Nessuna regressione senza montante ─────────────────────────────────
console.log('\nSenza montante nulla cambia\n');

const senzaMontante = computeAnnualGrossFromShifts(PASSATO, [], S);
verifica('senza montante → due mensilita intere', arr(senzaMontante.total), arr(2 * MENSILE), '');
verifica('  tutte dichiarate', arr(senzaMontante.extras), arr(2 * MENSILE), '');

// Chi non ha 13ª ne' 14ª non deve vedere comparire niente.
const senzaExtra = { ...S, hasTredicesima: false, hasQuattordicesima: false };
const nessuna = computeAnnualGrossFromShifts(PASSATO, [], { ...senzaExtra, priorTaxableIncome: MONTANTE, priorIncomeDate: `${PASSATO}-07-01` });
verifica('senza 13ª/14ª → solo il montante', arr(nessuna.total), MONTANTE, '');
verifica('  e nessuna una-tantum', arr(nessuna.extras), 0, '');

// ── 6. Il caso reale da cui e' partita la segnalazione ────────────────────
//
// Assunzione 29/12/2025 — dicembre non matura, restano tre giorni e ne
// servono quindici. Il periodo di competenza della 14ª va da luglio 2025 a
// giugno 2026: maturano i soli sei mesi del 2026. La 13ª segue l'anno solare
// 2026 ed e' intera. Non dipende dal giorno in cui gira lo script: l'anno e'
// un parametro, non una lettura dell'orologio.
console.log('\nIl caso reale: assunzione 29/12/2025\n');

const REALE = { ...S, hireDate: '2025-12-29' };
verifica('14ª del 2026 vale 6/12', extraMonthAccrual('quattordicesima', 2026, REALE), 0.5,
  'luglio-dicembre 2025 non maturano');
verifica('13ª del 2026 e intera', extraMonthAccrual('tredicesima', 2026, REALE), 1, '');

// Montante fermato a «tutto luglio 2026»: la 14ª di giugno e' dentro, la 13ª
// di dicembre deve ancora arrivare. Il maturato e' il montante e basta.
const caso = computeAnnualGrossFromShifts(2026, [], {
  ...REALE, priorTaxableIncome: MONTANTE, priorIncomeDate: '2026-07-01',
});
if (ANNO === 2026 && MESE > 6) {
  verifica('montante a luglio 2026 → maturato = montante', arr(caso.total), MONTANTE,
    'la 14ª non si risomma');
  verifica('  con mezza mensilita dichiarata', arr(caso.extras), arr(MENSILE * 0.5),
    'sta dentro il montante, non fuori');
} else {
  console.log(`  --  siamo nel ${ANNO}: il caso vive nel 2026, non si prova da qui`);
}

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
