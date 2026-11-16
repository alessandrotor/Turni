// Nessun testo nuovo parla di restituzione senza essere stato guardato:
//
//   node scripts/check-testi-restituzione.mjs
//
// DA DOVE VIENE: novembre 2026. Ogni anno ~2,3 milioni di dipendenti si vedono
// riprendere il tratt. integrativo a conguaglio, e alla gran parte torna IRPEF
// quasi per lo stesso importo (MEF, analisi IRPEF a.i. 2024). Chi mantiene il
// progetto l'ha messo come regola: non si guadagna sulla disinformazione, e
// accanto a «te lo riprendono» ci sono le tasse che tornano
// (docs/piano-per-agenti.md, sezione 1). Un giro sui testi ha sistemato quelli
// di allora; questo riscontro tiene il conto per file delle frasi a schermo che
// dicono «restituire» o «riprendere». Un conto che sale vuol dire un testo nuovo:
// lo si rilegge con quella regola in mente, e solo dopo si aggiorna il numero qui.
// Non giudica il testo (non può): obbliga a guardarlo.

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const VISTI = {
  'src/components/CalendarView.jsx': 1,
  'src/components/CiPerdo.jsx': 3,
  'src/components/PopupFiscali.jsx': 6,
  'src/components/RiquadroTI.jsx': 4,
  'src/components/Settings.jsx': 1,
};

// Le parole minuscole: `daRestituire` e `rischioRestituzione` sono nomi nel codice.
const PAROLA = /\b(restitui|restituz|riprend)/;
const contaFile = (testo) => testo.split('\n').filter((r) => {
  const t = r.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*') || t.startsWith('import ')) return false;
  return PAROLA.test(t.replace(/'restituisci'|"restituisci"/g, ''));
}).length;

let falliti = 0;
const cartella = join(RADICE, 'src/components');
// Icona.jsx ha solo il nome di un disegno, `restituisci`.
for (const f of readdirSync(cartella).filter((x) => x.endsWith('.jsx') && x !== 'Icona.jsx')) {
  const nome = `src/components/${f}`;
  const n = contaFile(readFileSync(join(cartella, f), 'utf8'));
  const visti = VISTI[nome] ?? 0;
  if (n > visti) {
    falliti += 1;
    console.log(`  FALLITO ${nome}: ${n} frasi su restituzione, ne erano state guardate ${visti}.`);
    console.log('          Accanto al tratt. integrativo ripreso vanno le tasse che tornano; poi aggiorna VISTI.');
  } else if (n < visti) {
    console.log(`  ok   ${nome}: ${n} (erano ${visti}: abbassa il conto in VISTI)`);
  }
}
console.log(falliti ? `\n${falliti} file con testi nuovi da rileggere.\n` : '\nNessun testo nuovo sulla restituzione senza essere stato guardato.\n');
process.exit(falliti ? 1 : 0);
