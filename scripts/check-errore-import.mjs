// Riscontro delle due famiglie di errore dell'import da foto:
//
//   node scripts/check-errore-import.mjs
//
// «L'immagine non è arrivata» e «l'immagine è arrivata ma non si legge»
// chiedono due gesti diversi (controllare la rete, rifare la foto). Il difetto
// silenzioso è un errore nuovo aggiunto senza famiglia: finirebbe nella
// famiglia di ripiego senza che nessuno lo decida. Per questo il riscontro non
// si fida degli elenchi: legge il servizio e il proxy e controlla ogni uscita.

import { readFileSync } from 'node:fs';
import { tipoDaRisposta, tipoDiErrore, erroreImport, TIPO_ERRORE, TITOLO_ERRORE } from '../src/utils/errore-import.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const { CARICAMENTO, LETTURA } = TIPO_ERRORE;

console.log('\nLe risposte del proxy\n');
// Ogni `return json({ error… }, stato)` del proxy, con la famiglia che il
// client gli darà. Letti dal sorgente, non ricopiati.
const proxy = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8');
const uscite = [...proxy.matchAll(/json\(\{\s*error:\s*([\s\S]*?)\}\s*,\s*(\d{3}|[^)]*\?[^)]*)\)/g)]
  .map(([, corpo, stato]) => ({
    testo: (corpo.match(/['"`]([^'"`]{6,})/) || [])[1] || corpo.slice(0, 40),
    stati: (stato.match(/\d{3}/g) || []).map(Number),
    tipo: (corpo.match(/tipo:\s*'(\w+)'/) || [])[1],
  }));
esito(uscite.length >= 15, 'il riscontro vede le uscite del proxy', `${uscite.length}`);

// Quelle che dicono «ho letto l'immagine, e i turni non ci sono o non ci
// stanno»: devono finire in LETTURA. Tutte le altre in CARICAMENTO.
const DI_LETTURA = /turno|turni|foglio turni/i;
const DI_SERVIZIO = /limite|troppi import|verifica|non risponde|non disponibile|configurato|Not found|Method/i;
for (const u of uscite) {
  for (const stato of u.stati) {
    const tipo = tipoDaRisposta(stato, { tipo: u.tipo });
    const atteso = DI_LETTURA.test(u.testo) && !DI_SERVIZIO.test(u.testo) ? LETTURA : CARICAMENTO;
    esito(tipo === atteso, `${stato} «${u.testo.slice(0, 55)}»`, tipo);
  }
}

console.log('\nIl client\n');
const servizio = readFileSync(new URL('../src/services/gemini.js', import.meta.url), 'utf8');
// Nessun `throw new Error` rimasto dove arriva a schermo: ognuno passa da
// `erroreImport` con la sua famiglia. L'unico `new Error` ammesso è quello
// interno del ridimensionamento, che viene preso e ripiega sull'originale.
const nudi = [...servizio.matchAll(/new Error\(([^)]*)\)/g)].map((m) => m[1]).filter((a) => a !== "'decode'");
esito(nudi.length === 0, 'ogni errore del servizio ha la sua famiglia', nudi.join(' · ') || 'nessun errore senza famiglia');
esito(/TIPO_ERRORE\.LETTURA[^;]*nessuna con data e orari/s.test(servizio),
  'righe lette ma tutte illeggibili → lettura, non una lista vuota in silenzio');
esito(tipoDiErrore(new TypeError('x')) === CARICAMENTO, 'un errore imprevisto ricade in caricamento');
esito(tipoDiErrore(erroreImport(LETTURA, 'x')) === LETTURA, 'la famiglia sopravvive fino allo schermo');
esito(TITOLO_ERRORE[CARICAMENTO] !== TITOLO_ERRORE[LETTURA], 'due titoli diversi a schermo');

console.log();
if (falliti) { console.error(`${falliti} caso/i non tornano.`); process.exit(1); }
console.log('Tutti i casi tornano.');
