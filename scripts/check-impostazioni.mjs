// «Il pulsante Salva o salva, o dice perché», riscontrato invece che sperato:
//
//   node scripts/check-impostazioni.mjs
//
// PERCHÉ ESISTE, E PERCHÉ LEGGE IL SORGENTE INVECE DI CHIAMARE UNA FUNZIONE
// Il difetto che questo file difende non sta in un calcolo: sta in tre
// attributi di marcatura, e si manifesta come NIENTE. Il modulo era un `<form>`
// con la validazione del browser accesa e sedici sezioni `<details>` quasi
// tutte chiuse: un campo invalido dentro una sezione chiusa faceva annullare
// l'invio senza un messaggio, perché il fumetto nativo non ha dove attaccarsi.
// Si premeva «Salva impostazioni» e non succedeva assolutamente nulla.
//
// Il guasto peggiore era che scattava su valori GIUSTI: `step="0.5"` rende
// invalido 37,25 (ore settimanali di un part-time), `step="1"` rende invalido
// 66,66 (percentuale di malattia), e su «ore di una giornata di assenza»
// rendeva invalido 6,67 — il numero che il segnaposto di quel campo suggerisce.
//
// Nessuna di queste tre cose si vede provando l'app con i propri dati, che sono
// tondi. Si vede solo leggendo la marcatura, ed è quello che si fa qui.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const FILE = join(QUI, '..', 'src', 'components', 'Settings.jsx');
const sorgente = readFileSync(FILE, 'utf8');

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(50)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// ── 1. La validazione è nostra, non del browser ────────────────────────────
console.log('\nChi mostra il problema\n');

const sezioni = (sorgente.match(/<details/g) || []).length;
verifica('le sezioni sono ancora tante', sezioni > 5, true,
  `${sezioni} <details>: è il motivo per cui il fumetto nativo non può funzionare`);

verifica('il form ha `noValidate`', /<form[^>]*\bnoValidate\b/.test(sorgente), true,
  'senza, il browser annulla l\'invio e non mostra niente');
verifica('esiste chi apre la sezione e porta il fuoco',
  sorgente.includes('reportValidity()') && /n\.tagName === 'DETAILS'/.test(sorgente), true,
  'togliere la validazione al browser senza rimetterla sarebbe peggio del difetto');
verifica('il submit se ne serve prima di salvare',
  /handleSubmit = \(e\) => \{\s*e\.preventDefault\(\);\s*if \(mostraIlProblema/.test(sorgente), true,
  'chiamarlo dopo aver già scritto le impostazioni non servirebbe a niente');

// ── 2. Nessun passo che rifiuta valori veri ────────────────────────────────
console.log('\nI passi dei campi numerici\n');

// Senza le righe di commento: qui sopra e dentro `Settings.jsx` gli `step`
// sbagliati sono CITATI per spiegare cosa facevano, e un controllo che li
// trovasse lì diventerebbe rosso per una frase invece che per un campo.
const marcatura = sorgente
  .split('\n')
  .filter((riga) => !/^\s*(\/\/|\*|\/\*)/.test(riga))
  .join('\n');

const passi = [...marcatura.matchAll(/step="([^"]+)"/g)].map((m) => m[1]);
const stretti = passi.filter((p) => p !== 'any');
verifica('nessuno `step` diverso da «any»', stretti, [],
  stretti.length
    ? `${stretti.join(', ')} — 37,25 ore e 66,66% sono valori veri, e uno step li rifiuta`
    : `${passi.length} campi`);

// ── 3. Le ore settimanali non possono valere zero ──────────────────────────
// Lo zero non è un valore basso: è un dato mancante travestito. Manda a zero la
// soglia dei supplementari — ogni ora lavorata diventa supplementare — e le ore
// di una giornata di ferie.
console.log('\nLo zero invisibile nelle ore settimanali\n');

const campo = sorgente.slice(
  sorgente.indexOf('id="expected-hours"'),
  sorgente.indexOf('id="expected-hours"') + 900,
);

verifica('il campo esiste', campo.length > 0, true);
verifica('è obbligatorio', /\brequired\b/.test(campo), true,
  'un <input type=number> vuoto senza `required` è valido, e salva 0');
verifica('non accetta lo zero', /min="([1-9]\d*)"/.test(campo), true,
  'con min="0" lo zero passa la validazione');
verifica('uno zero salvato si VEDE',
  /value=\{form\.expectedWeeklyHours \?\? ''\}/.test(campo), true,
  'con `|| \'\'` lo zero si mostrava come campo vuoto: identico a «non l\'ho ancora messo»');

console.log(falliti === 0
  ? `\n${totale} controlli: o salva, o dice dov'è il problema.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
