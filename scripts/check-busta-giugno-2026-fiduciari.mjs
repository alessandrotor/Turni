// Riscontro del motore netto contro una busta paga REALE, secondo contratto.
//
//   node scripts/check-busta-giugno-2026-fiduciari.mjs
//
// Busta di riferimento: giugno 2026, CCNL servizi fiduciari (divisore orario
// 173), livello D, lavoratrice INTERMITTENTE — 77,50 ore in 17 giorni, paga di
// fatto 9,43022 €/h. Serve a coprire un caso che le altre due buste non
// toccano: il lavoro a chiamata, dove non esiste mensilizzazione e si paga
// quello che si lavora.
//
// DATI PERSONALI: qui dentro ci sono soltanto cifre — ore, aliquote, importi.
// Nessun nome, codice fiscale, indirizzo, IBAN o datore di lavoro: la busta è di
// un'altra persona e nel repository non deve finire nulla che la identifichi.
//
// Tre cose che la busta dimostra, e che il motore già fa:
//  - RETRIBUZIONE ORDINARIA = 77,50 × 9,43022 = 730,84, cioè le ore lavorate e
//    basta: nessun monte ore fisso da retribuire;
//  - la griglia presenze va dall'1 al 30 giugno — mese di CALENDARIO, niente
//    settimane a cavallo come nei contratti mensilizzati;
//  - 9,43022 = 7,40711 (tabellare) + 0,61728 + 0,61728 + 0,17127 + 0,61728,
//    cioè i ratei orari di 13ª, ferie, ROL e 14ª sono GIÀ dentro la paga oraria.
//    Per questo, a chiamata, le caselle 13ª/14ª devono restare spente.

import { calcNetMonthly, calcNetAnnual, tiDecision, TAX_2026 } from '../src/utils/net.js';

const SETTINGS = {
  hourlyRate: 9.43022,
  onCall: true,
  // Per questo contratto lo straordinario scatta oltre le 10 ore GIORNALIERE.
  // A giugno non se ne fa: la giornata più lunga è 5,75 h.
  dailyOvertimeThreshold: 10,
  ccnl: 'vigilanza',
  hasTredicesima: false,
  hasQuattordicesima: false,
  // In busta le addizionali sono rate dell'ANNO PRECEDENTE (15,68 €), non una
  // percentuale sull'imponibile del mese: fuori dal confronto.
  addRegionalePct: 0,
  addComunalePct: 0,
  tfrInBusta: true,
};

// Voci del cedolino:
//   RETRIBUZIONE ORDINARIA  77,50 h × 9,43022 = 730,84
//   LAVORO FESTIVO   40%     5,00 h × 3,77209 =  18,86   (il 2 giugno)
//   LAVORO DOMENICALE 15%    5,00 h × 1,41453 =   7,07   (domenica 7)
const LORDO = 730.84 + 18.86 + 7.07;   // 756,77 — imponibile previdenziale
const GIORNI = 30;

// Reddito annuo di riferimento: la busta lo colloca fra 8.500 e 15.000 €, e lo
// dice due volte — la detrazione piena da 1.955 €/anno e l'indennità
// L. 207/2024 liquidata al 5,3%. L'imponibile IRPEF maturato a giugno (5.613,21)
// annualizzato ci cade in pieno.
const PROIEZIONE = 11226;

let failures = 0;

function check(label, actual, expected, tol) {
  const delta = Math.abs(actual - expected);
  const ok = delta <= tol;
  if (!ok) failures += 1;
  const fmt = (n) => n.toFixed(2).padStart(9);
  console.log(
    `${ok ? '  ok  ' : '  XX  '} ${label.padEnd(36)} ${fmt(actual)}  atteso ${fmt(expected)}  Δ ${delta.toFixed(2)}`,
  );
}

console.log('\nBusta giugno 2026 — servizi fiduciari, intermittente\n');

const n = calcNetMonthly(LORDO, PROIEZIONE, SETTINGS, GIORNI);

check('Lordo del mese', n.gross, 756.77, 0.01);
// 69,57 IVS + 4,31 «Altri» (0,57%). Lo scarto di 0,02 è la busta che calcola su
// un imponibile arrotondato a 757,00.
check('Contributi (IVS + 0,57%)', n.contributi, 74.45 - 0.57, 0.03);
// 682,89 = 756,77 − 69,57 − 4,31: l'EPAR (0,57) NON viene dedotto, ed è così che
// si scopre che è l'unico contributo non deducibile del cedolino.
check('Imponibile fiscale', n.imponibile, 682.89, 0.03);
check('IRPEF lorda (23%)', n.irpefLorda, 157.06, 0.03);
// 1.955 × 30/365. In busta è alla voce «ALTRE DETRAZIONI»: 160,68 esatti.
check('Detrazione spettante', n.detrazioni, 160.68, 0.01);
// Supera l'imposta, quindi in busta ne compare solo la parte capiente (157,06)
// e l'IRPEF del mese è zero.
check('  di cui capiente', n.detrazioniApplicate, 157.06, 0.03);
check('IRPEF netta (incapienza)', n.irpefNetta, 0, 0.01);
// 1.200 × 30/365, stessa regola dei giorni delle detrazioni.
check('Trattamento integrativo', n.trattamentoIntegrativo, 98.63, 0.01);
// 5,3% dell'IMPONIBILE, non del lordo: 682,89 × 0,053 = 36,19.
check('Indennità L. 207/2024 (5,3%)', n.bonusCuneo, 36.19, 0.02);
check('Imposta sostitutiva TFR (23%)', n.tfrImposta, n.tfrLordo * 0.23, 0.01);

// Netto: alla cifra stampata (827,42) vanno riaggiunte le due voci che l'app non
// sa rappresentare — le addizionali a rate dell'anno precedente e la trattenuta
// sindacale, che è una ritenuta sul netto mentre le voci fisse dell'app si
// sommano al lordo.
const NETTO_CONFRONTABILE = 827.42 + 15.68 + 12.81;
check('Netto (senza addiz. A.P. e sindacale)', n.net, NETTO_CONFRONTABILE, 2.10);

console.log('\nScarti noti, e da dove vengono\n');

// 1) EPAR: 0,10% su 574,05 = 77,50 h × 7,40711, cioè sulla paga TABELLARE.
//    L'app conosce solo la paga di fatto, quindi questo contributo resta fuori.
const EPAR = 0.57;
check('EPAR non modellato', 74.45 - n.contributi, EPAR, 0.03);

// 2) TFR: la busta prende la quota sulla sola retribuzione ordinaria (730,84),
//    senza le maggiorazioni, e toglie lo 0,50% sul lordo pieno:
//    730,84/13,5 − 0,005 × 756,77 = 50,35. Il motore usa il lordo intero.
//    NON si cambia la formula: l'art. 2120 c.c. include tutte le somme e
//    l'esclusione delle maggiorazioni è una scelta di contratto — una busta sola
//    non basta a farne una regola. Da rivedere se ne arriva una seconda.
const TFR_BUSTA = 730.84 / 13.5 - 0.005 * LORDO;
check('TFR: la formula della busta', TFR_BUSTA, 50.35, 0.01);
check('TFR: quanto calcola il motore', n.tfrLordo, 52.27, 0.02);
check('  scarto, tutto qui', n.tfrLordo - TFR_BUSTA, 1.92, 0.02);

// ---------------------------------------------------------------------------
// Trattamento integrativo: la capienza e il peso della proiezione annua.
//
// La stessa persona, a luglio, si è vista sparire il TI dall'app pur avendolo
// ricevuto. Non era un errore di calcolo del mese: era la PROIEZIONE annua,
// costruita sui soli turni inseriti (mesi vuoti = zero) e quindi troppo bassa.
// Sotto una certa soglia l'imposta lorda annua non copre la detrazione e il TI
// decade per incapienza — formalmente giusto, su un reddito sbagliato.
console.log('\nTrattamento integrativo: capienza e proiezione\n');

const check2 = (label, ok, extra = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label}${extra ? '  → ' + extra : ''}`);
};

{
  // Proiezione realistica, ricavata dal cedolino stesso: imponibile IRPEF
  // maturato a giugno 5.613,21, che a metà anno vale circa 11.200 di lordo.
  const REALE = 11226;
  const ti = tiDecision(REALE, SETTINGS);
  check2('con la proiezione vera il TI spetta', ti.incluso, ti.motivo);
  check2('  vale 1.200 € l\'anno', Math.abs(ti.importoAnnuo - 1200) < 0.01);

  // Proiezione che usciva dall'app con pochi mesi di turni inseriti.
  const PARZIALE = 8856;
  const tiP = tiDecision(PARZIALE, SETTINGS);
  check2('con la proiezione parziale decade', !tiP.incluso, tiP.motivo);

  // Lo sconto di 75 € nel test di capienza sposta il confine, e va verificato
  // che il confine sia quello: un reddito che sta in mezzo deve avere il TI.
  const a = calcNetAnnual(REALE, SETTINGS);
  check2('la capienza si misura sulla detrazione MENO 75 €',
    TAX_2026.TI_CAPIENZA_SCONTO === 75, String(TAX_2026.TI_CAPIENZA_SCONTO));
  // Reddito costruito perché l'imposta lorda cada fra detrazione−75 e detrazione:
  // senza lo sconto il TI verrebbe negato, con lo sconto spetta.
  const IN_MEZZO = 9100;
  const m = calcNetAnnual(IN_MEZZO, SETTINGS);
  const inFascia = m.irpefLorda > m.detrazioneLavoro - 75 && m.irpefLorda <= m.detrazioneLavoro;
  check2('caso di confine costruito bene', inFascia,
    `lorda ${m.irpefLorda.toFixed(2)} fra ${(m.detrazioneLavoro - 75).toFixed(2)} e ${m.detrazioneLavoro.toFixed(2)}`);
  check2('  e in quel caso il TI spetta', tiDecision(IN_MEZZO, SETTINGS).incluso);
  void a;
}

console.log(
  failures === 0
    ? '\n✓ tutti i riscontri superati: il motore torna anche sul lavoro a chiamata\n'
    : `\n✗ ${failures} riscontri falliti\n`,
);
process.exit(failures === 0 ? 0 : 1);
