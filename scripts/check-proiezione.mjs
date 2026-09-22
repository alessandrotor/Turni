// Riscontro della previsione di reddito annuo:
//
//   node scripts/check-proiezione.mjs
//
// LA PROPRIETA' CHE CONTA
// Un euro guadagnato in piu' deve spostare la previsione di ESATTAMENTE un
// euro. Sembra ovvio, e invece e' proprio cio' che non succedeva: la previsione
// annualizzava il maturato (× 12/mesi-trascorsi) e prendeva il massimo con la
// proiezione da contratto. Risultato misurato il 21 agosto, su un part-time con
// contratto da 1.032 €/mese e soglia bonus a 16.622 €:
//
//   +200 € di straordinari  →  margine fermo a 4.238 €   (il contratto faceva da pavimento)
//   +400 € di straordinari  →  margine 4.022 €           (-216)
//   +600 € di straordinari  →  margine 3.722 €           (-300 ogni 200 guadagnati)
//
// Il riquadro del bonus esiste per decidere se accettare uno straordinario:
// un numero che prima non si muove e poi si muove di una volta e mezza non
// serve a decidere niente.
//
// Questi riscontri NON sono coperti dagli script sulle buste reali: quelli
// passano il reddito annuo esplicitamente a `calcNetMonthly` e non toccano la
// previsione. Confermano che il netto non e' cambiato, non che la previsione
// sia giusta.

import { projectAnnualIncome, monthlyBaseGross } from '../src/utils/net.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(46)} atteso ${String(atteso).padStart(7)} → ${String(avuto).padStart(7)}  ${perche}`);
}

const arr = (n) => Math.round(n);
// Part-time 60% CCNL Turismo: 24 ore su sei giorni, 10 €/h.
const S = { hourlyRate: 10, expectedWeeklyHours: 24, workingDaysPerWeek: 6, ccnl: 'turismo' };
const MENSILE = monthlyBaseGross(S);
const prev = (maturato, extra = 0, s = S, anno = ANNO) =>
  projectAnnualIncome(maturato, extra, s, anno).value;

// L'anno CORRENTE, altrimenti `monthsElapsed` vale 12 e non si prova nulla.
const ANNO = new Date().getFullYear();
const MESE = new Date().getMonth() + 1;          // 1-12
const RESTANTI = Math.max(0, 12 - MESE);

console.log(`\nContratto: ${arr(MENSILE)} €/mese · siamo al mese ${MESE}, ne restano ${RESTANTI}\n`);

// ── 1. La proprieta' del marginale ─────────────────────────────────────────
console.log('Un euro in piu\' sposta la previsione di un euro\n');

const base = prev(8000);
for (const aggiunta of [1, 100, 200, 500, 1000, 2500]) {
  verifica(`+${aggiunta} € di straordinari`, arr(prev(8000 + aggiunta) - base), aggiunta,
    'la previsione sale di quanto si e guadagnato');
}

// Il caso che prima falliva in modo silenzioso: piccoli importi sotto il
// pavimento del contratto, che non muovevano nulla.
verifica('nessun pavimento sotto il contratto', prev(8200) > prev(8000), true,
  'prima restava identico');

// ── 2. Composizione ────────────────────────────────────────────────────────
console.log('\nDa cosa e\' fatta\n');

// Maturato zero significa davvero «non ho guadagnato nulla finora»: chi ha
// lavorato senza inserire i turni dichiara il pregresso col MONTANTE
// (`priorTaxableIncome`), che `computeAnnualGrossFromShifts` somma al maturato.
// Quindi qui NON si deve inventare uno storico che l'utente non ha dichiarato.
verifica('maturato zero → solo i mesi che restano',
  arr(prev(0)), arr(RESTANTI * MENSILE), 'non si inventa il pregresso');
verifica('maturato + resto dell anno',
  arr(prev(9000)), arr(9000 + RESTANTI * MENSILE), '');

// Auto-consistenza: chi ha segnato tutti i mesi trascorsi al valore da
// contratto ritrova esattamente le 12 mensilita'. E' la prova che il modello
// non sottostima chi tiene il calendario aggiornato.
verifica('calendario completo → 12 mensilita esatte',
  arr(prev(MENSILE * MESE)), arr(MENSILE * 12), 'maturato dei mesi passati + quelli futuri');

// Anno passato: non c'e' futuro da prevedere, la previsione E' il maturato.
verifica('anno passato → solo il maturato',
  arr(prev(11000, 0, S, ANNO - 1)), 11000, 'nessun mese da aggiungere');

// ── 3. I rami che NON cambiano ─────────────────────────────────────────────
console.log('\nLe scelte esplicite dell utente restano intatte\n');

const manuale = { ...S, annualGrossManual: 20000 };
verifica('importo scritto a mano vince', arr(prev(5000, 0, manuale)), 20000, 'ignora tutto il resto');
verifica('  e non dipende dal maturato', prev(5000, 0, manuale) === prev(15000, 0, manuale), true, '');

const ytd = { ...S, tiProjectionMode: 'ytd' };
verifica('modalita ytd: annualizza ancora', prev(8000, 0, ytd) !== prev(8000), true,
  'e una scelta esplicita, si rispetta');

const chiamata = { ...S, onCall: true };
verifica('a chiamata: annualizza ancora', arr(prev(8000, 0, chiamata)), arr((8000 * 12) / MESE),
  'non c e un contratto da cui prevedere');

// ── 4. Mensilita' aggiuntive contate una volta sola ────────────────────────
console.log('\n13ª e 14ª\n');

const conExtra = { ...S, hasTredicesima: true, hasQuattordicesima: true, hireDate: `${ANNO - 3}-01-01` };
// Il maturato include gia' le extra incassate: passarle come `annualExtras`
// non deve farle sparire ne' raddoppiare.
verifica('extra gia incassate non cambiano il totale',
  arr(prev(9000, 0, conExtra)), arr(prev(9000, 1032, conExtra)),
  'sono gia dentro il maturato, non si sommano due volte');

// Le mensilita' NON ancora incassate vanno aggiunte: a questo punto dell'anno
// la 13ª deve ancora arrivare, quindi il totale supera quello senza extra.
verifica('la 13ª che deve ancora arrivare si aggiunge',
  prev(9000, 0, conExtra) > prev(9000, 0, S), true, '');
verifica('  e vale una mensilita intera',
  arr(prev(9000, 0, conExtra) - prev(9000, 0, S)), arr(MENSILE), 'la 14ª di giugno e gia nel maturato');

// ── 5. Il bonus non si annualizza ──────────────────────────────────────────
//
// Il bonus si spunta mese per mese dal calendario: quando compare nella stima
// e' perche' qualcuno ha dichiarato di averlo preso, non perche' il motore lo
// preveda. E' un fatto, quindi vale quello che vale.
//
// In modalita' `ytd` finiva invece dentro il cumulativo che viene moltiplicato
// per 12/mesi-trascorsi: a settembre tre bonus da 120 € ne promettevano
// quattro (360 → 480). Su un premio di produttivita', che per definizione non
// torna ogni mese, era una previsione che l'app non aveva motivo di fare — lo
// stesso errore da cui 13ª e 14ª erano gia' protette.
//
// La prova sta nel confronto fra le due modalita': il bonus e' un importo
// dichiarato, e due modi diversi di proiettare il RESTO non possono farlo
// valere cifre diverse.
console.log('\nIl bonus vale quello che vale, in tutte le modalita\n');

const BONUS = 120;
const conBonus = (modo, mesi) => ({
  ...S,
  tiProjectionMode: modo,
  monthlyBonusAmount: BONUS,
  monthlyBonus: Object.fromEntries(mesi.map(m => [`${ANNO}-${String(m).padStart(2, '0')}`, true])),
});
const stima = (s) => projectAnnualIncome(9000, 0, s, ANNO).value;

for (const modo of ['stimato', 'ytd']) {
  const senza = stima({ ...S, tiProjectionMode: modo });
  verifica(`${modo}: tre bonus spostano la stima di 3 × 120`,
    arr(stima(conBonus(modo, [1, 2, 3])) - senza), 3 * BONUS, 'al valore nominale');
  verifica('  e dodici ne valgono dodici',
    arr(stima(conBonus(modo, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) - senza), 12 * BONUS,
    'e la simulazione «lo prendo ogni mese»');
}

// Le due modalita' rispondono a domande diverse e danno totali diversi: quello
// che NON puo' cambiare e' quanto pesa il bonus dentro ciascuna.
const pesoStimato = stima(conBonus('stimato', [1, 2, 3])) - stima({ ...S, tiProjectionMode: 'stimato' });
const pesoYtd = stima(conBonus('ytd', [1, 2, 3])) - stima({ ...S, tiProjectionMode: 'ytd' });
verifica('le due modalita lo pesano uguale', arr(pesoStimato), arr(pesoYtd),
  `prima ytd lo moltiplicava per 12/${MESE}`);

// ── La spiegazione deve sommare alla cifra che spiega ──────────────────────
//
// La pagina Statistiche apre un «Come e' calcolato?» che elenca le voci della
// previsione. Le voci arrivano da qui e non sono ricalcolate dalla UI proprio
// perche' non possano divergere — ma l'invariante va verificata, altrimenti
// «non possono divergere» resta un'intenzione. Un pannello che esiste per
// farsi controllare e che non quadra e' peggio di nessun pannello.

console.log('\nLe voci sommano al totale\n');

const casiVoci = [
  ['previsione, caso normale', 13000, 900, S],
  ['con voci fisse e bonus', 13000, 900, { ...S, fixedMonthlyItems: [{ amount: 10 }], monthlyBonusAmount: 120, monthlyBonus: { [`${ANNO}-06`]: true } }],
  ['reddito scritto a mano', 13000, 0, { ...S, annualGrossManual: 18000 }],
  ['lavoro a chiamata', 12000, 0, { onCall: true, hourlyRate: 10 }],
  ['modalita ytd', 12000, 800, { ...S, tiProjectionMode: 'ytd' }],
  ['nessun turno segnato', 0, 0, S],
];
for (const [nome, ag, ae, st] of casiVoci) {
  const r = projectAnnualIncome(ag, ae, st, ANNO);
  const somma = (r.voci || []).reduce((t, v) => t + v.valore, 0);
  verifica(nome, arr(somma), arr(r.value), `fonte: ${r.source}`);
}

// Ogni voce deve avere un'etichetta: una riga senza nome nel pannello e' una
// cifra che compare dal nulla.
const senzaEtichetta = projectAnnualIncome(13000, 900, S, ANNO).voci.filter(v => !v.label).length;
verifica('tutte le voci hanno un nome', senzaEtichetta, 0, '');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
