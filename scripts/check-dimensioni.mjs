// Nessun file cresce senza limite:
//
//   node scripts/check-dimensioni.mjs
//
// PERCHÉ ESISTE
// Il codice di quest'app lo scrive in gran parte un'AI, e un'AI aggiunge dove
// è più comodo: in fondo al file che ha già aperto. `CalendarView.jsx` è
// arrivato così a 2.211 righe — griglia, riquadro del trattamento integrativo,
// conguaglio, tre popup — e ogni modifica costa di più da leggere e da
// verificare. Nessuno l'ha deciso: è successo una riga alla volta.
//
// LA REGOLA
// Un file nuovo sta sotto LIMITE righe. Quelli già oltre sono congelati alla
// misura di oggi (`ECCEZIONI`): possono scendere, non salire. Quando un file
// scende, si abbassa il suo numero qui — il riscontro lo ricorda — così lo
// spazio liberato non torna a riempirsi. Spezzare un file è la risposta
// giusta; alzare un numero qui no, e se sembra inevitabile si chiede prima.
//
// `index.css` è un caso a parte: un foglio solo è una scelta del progetto (il
// riscontro della leggibilità lo legge tutto), ma anche lui non cresce oltre.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMITE = 600;
const ECCEZIONI = {
  'src/components/CalendarView.jsx': 1711,
  'src/components/Settings.jsx': 1894,
  'src/utils/net.js': 1105,
  'src/App.jsx': 751,
  'src/components/ShiftForm.jsx': 690,
  'src/index.css': 3720,
};
const CARTELLE = ['src', 'worker/src', 'scripts'];
const ESTENSIONI = /\.(js|jsx|mjs|css)$/;

const file = [];
const visita = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) visita(p);
    else if (ESTENSIONI.test(n)) file.push(p);
  }
};
CARTELLE.forEach((c) => visita(join(RADICE, c)));

let falliti = 0;
const daAbbassare = [];
for (const p of file.sort()) {
  const nome = relative(RADICE, p).replaceAll('\\', '/');
  const testo = readFileSync(p, 'utf8');
  const righe = testo.split('\n').length - (testo.endsWith('\n') ? 1 : 0);
  const tetto = ECCEZIONI[nome] ?? LIMITE;
  if (righe > tetto) {
    falliti += 1;
    console.log(`FALLITO ${nome}: ${righe} righe, il tetto è ${tetto}. Spezzalo invece di alzare il numero.`);
  } else if (ECCEZIONI[nome] && righe < ECCEZIONI[nome] - 20) {
    daAbbassare.push(`${nome}: ${righe} (tetto ${ECCEZIONI[nome]})`);
  }
}
for (const nome of Object.keys(ECCEZIONI)) {
  if (!file.some((p) => relative(RADICE, p).replaceAll('\\', '/') === nome)) {
    falliti += 1;
    console.log(`FALLITO eccezione per ${nome}, che non esiste più: va tolta.`);
  }
}
if (daAbbassare.length) {
  falliti += 1;
  console.log(`FALLITO file scesi sotto il loro tetto: abbassalo in ECCEZIONI, o lo spazio torna a riempirsi.\n  ${daAbbassare.join('\n  ')}`);
}
console.log(falliti ? `\n${falliti} problemi.` : `\n${file.length} file: tutti sotto ${LIMITE} righe o sotto il loro tetto.`);
process.exit(falliti ? 1 : 0);
