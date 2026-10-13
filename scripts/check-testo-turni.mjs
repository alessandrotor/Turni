// RISCONTRO: i turni scritti a parole si leggono come li legge una persona, e
// quello che non si capisce si dice invece di indovinarlo.
//
//   node scripts/check-testo-turni.mjs
//
// Non verifica cifre di una busta: verifica una regola d'uso. Il testo di un
// messaggio («Lun 8-16, Mar 10-18, Mer riposo») diventa turni con le date
// giuste; un giorno di riposo fa comunque avanzare il giorno dopo; più
// intervalli nello stesso giorno sono più turni; e un orario senza un giorno
// finisce fra le righe non capite, non in un giorno inventato.
//
// «Oggi» è sempre dichiarato: il motore e i suoi satelliti non leggono
// l'orologio, e un riscontro che dipende dalla data del computer non è un
// riscontro.
import { leggiTestoTurni } from '../src/utils/testo-turni.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio && !ok ? '  — ' + dettaglio : ''}`);
};
const riga = (t) => `${t.date} ${t.startTime}-${t.endTime}`;
const elenco = (r) => r.turni.map(riga).join(' | ');
const D = (s) => new Date(`${s}T10:00:00`);

console.log('\nGiorni scritti col nome\n');
const dom = D('2026-10-11');           // domenica: «Lun» è domani
let r = leggiTestoTurni('Lun 8-16, Mar 10-18, Mer riposo, Gio 14-22', { oggi: dom });
esito(elenco(r) === '2026-10-12 08:00-16:00 | 2026-10-13 10:00-18:00 | 2026-10-15 14:00-22:00',
  'il lunedì più vicino a oggi, poi in avanti', elenco(r));
esito(r.saltati.length === 1 && r.saltati[0].date === '2026-10-14' && r.saltati[0].motivo === 'riposo',
  'il riposo del mercoledì non è un turno, ma sposta il giovedì', JSON.stringify(r.saltati));
esito(r.serveInizio === true, 'dice che la data è stata dedotta dal nome del giorno');

r = leggiTestoTurni('Lun 8-16\nMar 8-16', { oggi: D('2026-10-14') });
esito(elenco(r) === '2026-10-12 08:00-16:00 | 2026-10-13 08:00-16:00', 'mercoledì: il lunedì è due giorni fa', elenco(r));

r = leggiTestoTurni('Lun 8-16\nMar 8-16', { oggi: D('2026-10-14'), inizio: '2026-10-19' });
esito(elenco(r) === '2026-10-19 08:00-16:00 | 2026-10-20 08:00-16:00', '«Parti da» sposta tutto', elenco(r));

console.log('\nGiorni scritti con la data\n');
r = leggiTestoTurni('05/10 8:00-16:00\n06/10 14.30-22', { oggi: dom });
esito(elenco(r) === '2026-10-05 08:00-16:00 | 2026-10-06 14:30-22:00', 'gg/mm con ore e minuti', elenco(r));
r = leggiTestoTurni('5 ottobre 8-16 pausa 30', { oggi: dom });
esito(elenco(r) === '2026-10-05 08:00-16:00' && r.turni[0].breakMinutes === 30, '«5 ottobre» e la pausa', JSON.stringify(r.turni));
r = leggiTestoTurni('Lun 05/10/2026 dalle 8 alle 16', { oggi: dom });
esito(elenco(r) === '2026-10-05 08:00-16:00', 'nome + data + «dalle … alle …»', elenco(r));
r = leggiTestoTurni('dal 5 al 11 ottobre\nLun 8-16\nMar 8-16', { oggi: D('2026-10-02') });
esito(elenco(r) === '2026-10-05 08:00-16:00 | 2026-10-06 08:00-16:00', '«dal 5 al 11 ottobre» dice da dove si parte', elenco(r));
r = leggiTestoTurni('Ottobre 2026\nLun 5 8-16\nMar 6 8-16', { oggi: dom });
esito(elenco(r) === '2026-10-05 08:00-16:00 | 2026-10-06 08:00-16:00', '«Lun 5» con il mese in testa', elenco(r));
r = leggiTestoTurni('Ottobre 2026\nMar 5 8-16', { oggi: dom });
esito(r.turni.length === 1 && r.avvisi.length === 1, 'giorno e numero che non tornano: tiene la data e lo dice', JSON.stringify(r.avvisi));

console.log('\nPiù turni, orari particolari\n');
r = leggiTestoTurni('Lun 6-10 e 18-22', { oggi: dom });
esito(elenco(r) === '2026-10-12 06:00-10:00 | 2026-10-12 18:00-22:00', 'due intervalli nello stesso giorno', elenco(r));
r = leggiTestoTurni('Lun 8-16 Mar 10-18 Mer 8-16', { oggi: dom });
esito(elenco(r) === '2026-10-12 08:00-16:00 | 2026-10-13 10:00-18:00 | 2026-10-14 08:00-16:00',
  '«16 Mar» è la fine di un orario e un martedì, non il 16 marzo', elenco(r));
r = leggiTestoTurni('16 marzo 8-16', { oggi: D('2026-03-10') });
esito(elenco(r) === '2026-03-16 08:00-16:00', '«16 marzo» per esteso è una data', elenco(r));
r = leggiTestoTurni('Lun 8-12, Lun 14-18', { oggi: dom });
esito(elenco(r) === '2026-10-12 08:00-12:00 | 2026-10-12 14:00-18:00', 'lo stesso lunedì scritto due volte non salta una settimana', elenco(r));
r = leggiTestoTurni('Ven 22-6', { oggi: dom });
esito(elenco(r) === '2026-10-09 22:00-06:00', 'notte a cavallo della mezzanotte (il venerdì più vicino)', elenco(r));
r = leggiTestoTurni('Lun 8.30-12.30', { oggi: dom });
esito(elenco(r) === '2026-10-12 08:30-12:30', 'ore con il punto', elenco(r));
r = leggiTestoTurni('Lun 14-24', { oggi: dom });
esito(elenco(r) === '2026-10-12 14:00-00:00', '«24» è mezzanotte', elenco(r));

console.log('\nCosa non è un turno, cosa non si capisce\n');
r = leggiTestoTurni('Mer ferie', { oggi: dom });
esito(r.turni.length === 0 && r.saltati[0]?.motivo === 'ferie', 'le ferie non sono un turno');
r = leggiTestoTurni('8-16', { oggi: dom });
esito(r.turni.length === 0 && r.nonCapite.length === 1, 'un orario senza giorno non diventa un giorno inventato', JSON.stringify(r));
r = leggiTestoTurni('Lun boh', { oggi: dom });
esito(r.turni.length === 0 && r.nonCapite.length === 1, 'un giorno senza orari né motivo è «non capito»');
r = leggiTestoTurni('', { oggi: dom });
esito(r.turni.length === 0 && r.nonCapite.length === 0, 'testo vuoto: niente');

console.log('\nTesto copiato da WhatsApp\n');
r = leggiTestoTurni('[18:32, 11/10/2026] Mario Rossi: Lun 8-16\n[18:33, 11/10/2026] Mario Rossi: Mar 10-18', { oggi: dom });
esito(elenco(r) === '2026-10-12 08:00-16:00 | 2026-10-13 10:00-18:00', 'orario e mittente davanti al messaggio non diventano turni', elenco(r));

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
