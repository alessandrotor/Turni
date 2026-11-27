// Riscontro: il file Excel dell'export si apre e contiene quello che l'app ci ha messo.
//
// `xlsx` (SheetJS) è uscito dal progetto a novembre 2026: abbandonato su npm, con due
// difetti di sicurezza noti e nessuna versione a cui aggiornare (COSE-NUOVE F7). Al suo posto
// `write-excel-file`, che sa solo scrivere, cioè l'unica cosa che l'app faceva.
//
// Il cambio di libreria è il momento in cui l'export può rompersi senza che nessuno lo
// provi: chi lo usa è chi porta i turni al consulente, una volta al mese. Qui il foglio si
// genera in Node con lo stesso modulo del browser, si apre lo zip e si guarda dentro:
//  - è un .xlsx vero (le parti che Excel pretende ci sono);
//  - il foglio si chiama «Turni», i numeri restano numeri e i testi accentati restano tali;
//  - le larghezze delle colonne arrivano;
//  - `xlsx` non torna fra le dipendenze per sbaglio.
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { creaFoglioExcel, inBase64 } from '../src/services/foglio-excel.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${etichetta}${dettaglio ? ` — ${dettaglio}` : ''}`);
  if (!ok) falliti++;
};

const righe = [
  ['Turni – Novembre 2026'],
  [],
  ['Data', 'Giorno', 'Tipo', 'Inizio', 'Fine', 'Pausa (min)', 'Ore', 'Note'],
  ['02/11/2026', 'Lunedì', 'Lavoro', '08:00', '16:00', 30, 7.5, 'cambio & <turno>'],
  ['03/11/2026', 'Martedì', 'Ferie', '', '', 0, 4.8, ''],
  [],
  ['', '', '', '', '', 'Totale ore', 12.3, ''],
];

const byte = await creaFoglioExcel(righe, { foglio: 'Turni', larghezze: [12, 11, 10, 8, 8, 11, 8, 28] });
const zip = unzipSync(byte);
const parti = Object.keys(zip);

for (const p of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']) {
  esito(parti.includes(p), `il file ha ${p}`);
}

const cartella = strFromU8(zip['xl/workbook.xml']);
esito(/<sheet [^>]*name="Turni"/.test(cartella), 'il foglio si chiama «Turni»');

const foglio = strFromU8(zip['xl/worksheets/sheet1.xml']);
const condivise = zip['xl/sharedStrings.xml'] ? strFromU8(zip['xl/sharedStrings.xml']) : '';
const testi = foglio + condivise;

esito(/<v>7\.5<\/v>/.test(foglio) && /<v>12\.3<\/v>/.test(foglio), 'le ore restano numeri, sommabili in Excel');
esito(testi.includes('Lunedì') && testi.includes('Turni – Novembre 2026'), 'accenti e trattino lungo arrivano intatti');
esito(testi.includes('cambio &amp; &lt;turno&gt;'), 'una nota con & e < non rompe il file');
esito(/<col [^>]*width="28"/.test(foglio), 'le larghezze delle colonne arrivano');

const b64 = inBase64(byte);
esito(Buffer.from(b64, 'base64').equals(Buffer.from(byte)), 'la conversione in base64 per la consegna non perde byte');

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const dip = { ...pkg.dependencies, ...pkg.devDependencies };
esito(!('xlsx' in dip), '`xlsx` non è fra le dipendenze');

if (falliti) { console.log(`\n${falliti} controlli falliti.`); process.exit(1); }
console.log('\nIl foglio Excel dell\'export si apre e dice il vero.');
