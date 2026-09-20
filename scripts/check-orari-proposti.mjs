// Gli orari che il modulo propone da solo, riscontrati con:
//
//   node scripts/check-orari-proposti.mjs
//
// PERCHÉ ESISTE
// Questa è l'unica cosa che l'app SCRIVE AL POSTO DELL'UTENTE dentro un campo
// che tocca i soldi. Un orario proposto male non dà errore: viene salvato, e
// diventa ore lavorate, maggiorazioni, lordo e netto. Merita lo stesso
// trattamento dei fatti retributivi.
//
// La proprietà che conta più di tutte è la 7: **la coppia proposta esiste
// letteralmente nello storico, oppure è ORARI_DEFAULT.** È ciò che distingue la
// moda da una media — che proporrebbe `08:37`, un orario mai esistito, con
// l'aria di saperlo. Qui si verifica su cento storie generate a caso, non su
// un esempio scelto apposta.

import { readFileSync } from 'node:fs';
import {
  proponiOrari, sagomeFrequenti, ORARI_DEFAULT, FINESTRA_GIORNI, MAX_SAGOME,
} from '../src/utils/orari-proposti.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(44)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// Comodità: un turno di lavoro.
const t = (date, startTime, endTime, breakMinutes = 0) => ({
  id: `${date}-${startTime}`, date, startTime, endTime, breakMinutes,
});
const ripeti = (n, f) => Array.from({ length: n }, (_, i) => f(i));
// Giorni consecutivi a partire da una data, senza dipendere dal fuso.
const giorno = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const coppia = (o) => `${o.startTime}–${o.endTime}`;

// ── 1. Nessuno storico: il modulo di sempre ────────────────────────────────
console.log('\nQuando non c\'è niente da cui imparare\n');

verifica('storia vuota', proponiOrari([], '2026-09-02'),
  { ...ORARI_DEFAULT, fonte: 'default' }, 'esattamente il form di prima');
verifica('turni non passati', proponiOrari(undefined, '2026-09-02').fonte, 'default', 'nessuna eccezione');
verifica('data assurda', proponiOrari([t('2026-09-01', '09:00', '17:00')], 'non-una-data').fonte,
  'default', 'meglio il default che un errore in faccia');

// Le assenze non hanno orari: una giornata di ferie non dice niente su quando
// si entra al lavoro.
const soloAssenze = [
  { id: 'a', date: '2026-09-01', type: 'ferie', durationMinutes: 240 },
  { id: 'b', date: '2026-09-02', type: 'malattia', durationMinutes: 240 },
  { id: 'c', date: '2026-09-03', type: 'festivita', durationMinutes: 240 },
];
verifica('solo ferie e malattia', proponiOrari(soloAssenze, '2026-09-04').fonte,
  'default', 'un\'assenza non ha un orario da cui copiare');

// ── 2. La moda ─────────────────────────────────────────────────────────────
console.log('\nLa coppia che ricorre di più\n');

verifica('un turno solo', coppia(proponiOrari([t('2026-09-01', '16:00', '23:00')], '2026-09-02')),
  '16:00–23:00', 'soglia uno: uno vale più di un default mai verificato');

const misto = [
  ...ripeti(10, (i) => t(giorno('2026-08-20', i), '06:00', '14:00')),
  ...ripeti(3, (i) => t(giorno('2026-09-01', i), '14:00', '22:00')),
];
verifica('10 mattine contro 3 pomeriggi', coppia(proponiOrari(misto, '2026-09-10')),
  '06:00–14:00', 'vince chi ricorre di più, non chi è più recente');
verifica('la seconda sagoma c\'è', coppia(sagomeFrequenti(misto, '2026-09-10')[1]),
  '14:00–22:00', 'e serve ai chip del modulo');
verifica('fonte dichiarata', proponiOrari(misto, '2026-09-10').fonte, 'storico', '');

// ── 3. La finestra ─────────────────────────────────────────────────────────
console.log('\nLa finestra, centrata sul turno e non su oggi\n');

// Marzo è pieno di mattine, agosto di sere. Un turno di agosto deve ricevere
// agosto: è il caso di chi recupera i turni in ritardo.
const primavera = ripeti(30, (i) => t(giorno('2026-03-01', i), '06:00', '14:00'));
const estate = ripeti(8, (i) => t(giorno('2026-08-01', i), '17:00', '01:00'));
const anno = [...primavera, ...estate];
verifica('un turno di agosto', coppia(proponiOrari(anno, '2026-08-10')),
  '17:00–01:00', '30 mattine di marzo non contano: sono fuori finestra');
verifica('un turno di marzo', coppia(proponiOrari(anno, '2026-03-15')),
  '06:00–14:00', 'e viceversa');
verifica('fuori finestra da entrambi i lati',
  sagomeFrequenti(anno, '2026-12-01').length, 0, 'dicembre non ha niente vicino');

// La finestra è centrata: guarda anche AVANTI. Chi segna il 1° del mese dopo
// aver già inserito il resto del mese non deve ripartire dal default.
verifica('guarda anche i turni successivi',
  coppia(proponiOrari(ripeti(5, (i) => t(giorno('2026-09-10', i), '13:00', '21:00')), '2026-09-05')),
  '13:00–21:00', 'la finestra è centrata, non solo passata');
verifica('il bordo della finestra è incluso',
  sagomeFrequenti([t(giorno('2026-09-02', -FINESTRA_GIORNI), '05:00', '13:00')], '2026-09-02').length,
  1, `esattamente ${FINESTRA_GIORNI} giorni prima`);
verifica('un giorno oltre il bordo, fuori',
  sagomeFrequenti([t(giorno('2026-09-02', -FINESTRA_GIORNI - 1), '05:00', '13:00')], '2026-09-02').length,
  0, '');

// ── 4. Pareggio e determinismo ─────────────────────────────────────────────
console.log('\nA pari merito, e sempre lo stesso risultato\n');

// Due coppie con lo stesso conteggio: vince quella usata più vicino alla data.
const pari = [
  ...ripeti(3, (i) => t(giorno('2026-08-05', i), '07:00', '15:00')),
  ...ripeti(3, (i) => t(giorno('2026-08-25', i), '15:00', '23:00')),
];
verifica('pareggio: vince la più vicina', coppia(proponiOrari(pari, '2026-08-28')),
  '15:00–23:00', 'stesso conteggio, distanza diversa');
verifica('pareggio, dall\'altro lato', coppia(proponiOrari(pari, '2026-08-02')),
  '07:00–15:00', '');

// Pareggio pieno: stesso conteggio E stessa distanza. Senza il terzo criterio
// il risultato dipenderebbe dall'ordine dell'array.
const simmetrico = [
  t('2026-08-10', '09:00', '17:00'), t('2026-08-10', '20:00', '23:00'),
  t('2026-08-14', '09:00', '17:00'), t('2026-08-14', '20:00', '23:00'),
];
verifica('pareggio pieno: ordine alfabetico', coppia(proponiOrari(simmetrico, '2026-08-12')),
  '09:00–17:00', 'criterio dichiarato, non il caso');

// Mescolare l'ingresso non deve cambiare l'uscita.
let stabile = true;
const atteso = JSON.stringify(sagomeFrequenti(misto, '2026-09-10'));
for (let giro = 0; giro < 50; giro++) {
  const mescolato = [...misto];
  for (let i = mescolato.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mescolato[i], mescolato[j]] = [mescolato[j], mescolato[i]];
  }
  if (JSON.stringify(sagomeFrequenti(mescolato, '2026-09-10')) !== atteso) stabile = false;
}
verifica('50 mescolate, stesso risultato', stabile, true, 'l\'ordinamento è totale');

// ── 5. Mai inventato ───────────────────────────────────────────────────────
// La proprietà che distingue la moda da una media. Su cento storie a caso, la
// coppia proposta o esiste nello storico o è il default. Non c'è una terza
// possibilità, e non deve esserci mai.
console.log('\nLa proposta non è mai un orario inventato\n');

const ORE = ['05:30', '06:00', '07:15', '09:00', '13:45', '16:00', '17:30', '22:00', '23:30'];
let inventati = 0;
for (let storia = 0; storia < 100; storia++) {
  const turni = ripeti(1 + Math.floor(Math.random() * 25), () => {
    const a = ORE[Math.floor(Math.random() * ORE.length)];
    const b = ORE[Math.floor(Math.random() * ORE.length)];
    return t(giorno('2026-07-01', Math.floor(Math.random() * 90)), a, b, [0, 15, 30][Math.floor(Math.random() * 3)]);
  });
  const data = giorno('2026-07-01', Math.floor(Math.random() * 90));
  const p = proponiOrari(turni, data);
  const esiste = turni.some((x) => x.startTime === p.startTime && x.endTime === p.endTime);
  const eDefault = p.startTime === ORARI_DEFAULT.startTime && p.endTime === ORARI_DEFAULT.endTime;
  if (!esiste && !eDefault) inventati++;
}
verifica('100 storie a caso', inventati, 0, 'nessun orario che nessuno ha mai fatto');

// ── 6. Cosa copia e cosa no ────────────────────────────────────────────────
console.log('\nLa pausa solo se unanime, il resto mai\n');

const pausaUnanime = ripeti(4, (i) => t(giorno('2026-09-01', i), '09:00', '18:00', 60));
verifica('pausa unanime: si propone', proponiOrari(pausaUnanime, '2026-09-06').breakMinutes,
  60, 'quattro turni su quattro dicono la stessa cosa');

const pausaDiscorde = [
  t('2026-09-01', '09:00', '18:00', 60), t('2026-09-02', '09:00', '18:00', 30),
  t('2026-09-03', '09:00', '18:00', 60), t('2026-09-04', '09:00', '18:00', 0),
];
verifica('pausa discorde: zero', proponiOrari(pausaDiscorde, '2026-09-06').breakMinutes,
  0, 'meglio niente che togliere minuti pagati a caso');

const conExtra = ripeti(3, (i) => ({
  ...t(giorno('2026-09-01', i), '10:00', '19:00', 15),
  surchargePct: 30, note: 'sostituzione Mario',
}));
const proposta = proponiOrari(conExtra, '2026-09-05');
verifica('mai la maggiorazione', 'surchargePct' in proposta, false, 'cambierebbe i soldi fuori dagli occhi');
verifica('mai la nota', 'note' in proposta, false, 'riguarda un giorno solo');
verifica('le chiavi sono solo queste', Object.keys(proposta).sort(),
  ['breakMinutes', 'endTime', 'fonte', 'startTime'], '');

// ── 7. Dati sporchi ────────────────────────────────────────────────────────
console.log('\nQuello che arriva rotto non deve rompere\n');

const sporchi = [
  t('2026-09-01', '09:00', '17:00'),
  { id: 'x', date: '2026-09-02', startTime: null, endTime: '17:00' },
  { id: 'y', date: null, startTime: '09:00', endTime: '17:00' },
  { id: 'z', date: '2026-09-03', startTime: 'boh', endTime: '17:00' },
  null,
  { id: 'w', date: '2026-09-04' },
];
verifica('turni incompleti saltati', sagomeFrequenti(sporchi, '2026-09-05').length,
  1, 'ne resta uno solo, quello buono');
verifica('e la proposta è quello', coppia(proponiOrari(sporchi, '2026-09-05')), '09:00–17:00', '');

// `24:00` non è un orario che `<input type="time">` sappia mostrare: se
// finisse nel campo, quel campo resterebbe VUOTO ed essendo `required`
// bloccherebbe il salvataggio con il popup del browser. Trovato provando in
// Chromium, non ragionandoci sopra.
const mezzanotte = [
  ...ripeti(5, (i) => t(giorno('2026-09-01', i), '16:00', '24:00')),
  t('2026-09-07', '16:00', '23:59'),
];
verifica('un 24:00 nello storico non si propone',
  coppia(proponiOrari(mezzanotte, '2026-09-08')), '16:00–23:59',
  'cinque contro uno, ma cinque non si possono scrivere nel campo');
verifica('e nemmeno fra le sagome',
  sagomeFrequenti(mezzanotte, '2026-09-08').some((s) => s.endTime === '24:00'), false, '');
verifica('ore e minuti fuori scala', sagomeFrequenti([
  t('2026-09-01', '25:00', '30:00'), t('2026-09-02', '10:70', '12:00'),
], '2026-09-03').length, 0, '');

// ── 8. La guardia contro il ritorno indietro ───────────────────────────────
// Nello stile del punto 3 di `check-aggiornamento.mjs`: la regola vive nel
// modulo, non sparsa nei componenti. Se qualcuno riscrive gli orari a mano
// dentro il form, questo controllo lo dice.
console.log('\nLa regola sta in un posto solo\n');

const form = readFileSync('src/components/ShiftForm.jsx', 'utf8')
  .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
verifica('nessun orario scritto a mano nel form',
  /'0[0-9]:00'|"0[0-9]:00"|'1[0-9]:00'|"1[0-9]:00"/.test(form), false,
  'gli orari vengono da qui, non da là');
verifica('il form importa la proposta', form.includes('proponiOrari'), true, '');
verifica('MAX_SAGOME è un numero utile', MAX_SAGOME >= 2 && MAX_SAGOME <= 5, true,
  `${MAX_SAGOME}: abbastanza per un turnista, non una lista da leggere`);

console.log(falliti === 0
  ? `\n${totale} controlli: la proposta viene dai turni veri.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
