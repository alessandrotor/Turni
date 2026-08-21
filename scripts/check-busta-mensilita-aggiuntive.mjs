// Riscontro delle MENSILITA' AGGIUNTIVE contro tre cedolini reali:
//
//   node scripts/check-busta-mensilita-aggiuntive.mjs
//
// PERCHE' PROPRIO QUESTE
// Tredicesima e quattordicesima erano l'unica parte importante del motore che
// nessun dato reale toccava. `extraMonthAccrual` decide quanti dodicesimi
// spettano, e la proiezione annua — quella che dice al lavoratore quanto gli
// manca alla soglia del trattamento integrativo — ci si appoggia sopra. Un
// errore qui sposta il margine su cui si decide se accettare uno straordinario.
//
// I TRE CASI, e non sono ridondanti
//   13ª 2024   assunzione 02/07/2024 → mezza mensilita': il caso «assunto a
//              meta' anno», che e' quello che il motore deve saper fare.
//   13ª 2025   assunzione 16/06/2025 → 7/12. Il giorno 16 e' il caso limite
//              della regola dei quindici giorni: giugno ha 30 giorni, dal 16
//              ne restano 15 esatti. Un «>» al posto di un «>=» si vedrebbe qui
//              e in nessun altro posto.
//   14ª 2025   stessa assunzione, ma periodo di competenza luglio–giugno →
//              1/12. Prova che i due periodi sono davvero distinti: se la 14ª
//              seguisse l'anno solare come la 13ª, darebbe 7/12 e non 1/12.
//
// COME SI LEGGONO I NUMERI DEL CEDOLINO
// La mensilita' aggiuntiva e' stampata in ORE, non in mensilita': «8,64738 ×
// 60,20 ORE». Le ore di una mensilita' piena sono 103,20 (24 h settimanali,
// part time 60%), quindi il rateo e' ore/103,20 — ed e' cosi' che si confronta
// con `extraMonthAccrual`, che restituisce una frazione.
//
// I DATI NON STANNO QUI. Le fixture si generano dai PDF personali e la cartella
// e' ignorata da git: senza, il riscontro si salta invece di fallire.

import { extraMonthAccrual, monthlyBaseGross } from '../src/utils/net.js';
import { fixtureOSalta, voce, confronto } from './lib/fixture-buste.mjs';

const TITOLO = 'Mensilita’ aggiuntive contro i cedolini reali';

const [t24, t25, q25] = fixtureOSalta(TITOLO,
  'cedolino-13esima-24', 'cedolino-13esima-25', 'cedolino-14esima-25');

const { check, fine } = confronto();

// Il contratto e' lo stesso in tutti e tre: CCNL Turismo, part time 60%,
// 24 ore settimanali. Cambia solo la data di assunzione, che il cedolino porta
// con se'.
const contratto = (fx, codice) => ({
  hourlyRate: voce(fx, codice).numeri[0],
  expectedWeeklyHours: 24,
  ccnl: 'turismo',
  hireDate: fx.contratto.assunzione,
  hasTredicesima: true,
  hasQuattordicesima: true,
});

console.log(`\n${TITOLO}\n`);

// ── 13ª 2024 — assunto il 2 luglio, mezza mensilita' ───────────────────────
console.log('13ª dicembre 2024 — assunzione 02/07/2024\n');
{
  const v = voce(t24, '003501');
  const s = contratto(t24, '003501');
  const orePiene = monthlyBaseGross(s) / s.hourlyRate;

  check('assunzione letta dal cedolino', s.hireDate, '2024-07-02');
  check('ore di una mensilita’ piena', orePiene, 103.20, 0.01);
  check('rateo: motore vs cedolino', extraMonthAccrual('tredicesima', 2024, s), v.numeri[1] / orePiene, 0.001);
  check('  in ore', orePiene * extraMonthAccrual('tredicesima', 2024, s), v.numeri[1], 0.01);
  check('  in euro', monthlyBaseGross(s) * extraMonthAccrual('tredicesima', 2024, s), v.importo, 0.02);
}

// ── 13ª 2025 — assunto il 16 giugno, sette dodicesimi ──────────────────────
console.log('\n13ª dicembre 2025 — assunzione 16/06/2025 (regola dei 15 giorni)\n');
{
  const v = voce(t25, '003501');
  const s = contratto(t25, '003501');
  const orePiene = monthlyBaseGross(s) / s.hourlyRate;

  check('assunzione letta dal cedolino', s.hireDate, '2025-06-16');
  check('giugno matura (30 − 16 + 1 = 15)', extraMonthAccrual('tredicesima', 2025, s) * 12, 7, 0.001);
  check('rateo: motore vs cedolino', extraMonthAccrual('tredicesima', 2025, s), v.numeri[1] / orePiene, 0.001);
  check('  in ore', orePiene * extraMonthAccrual('tredicesima', 2025, s), v.numeri[1], 0.01);
  check('  in euro', monthlyBaseGross(s) * extraMonthAccrual('tredicesima', 2025, s), v.importo, 0.02);
}

// ── 14ª 2025 — periodo luglio–giugno, un dodicesimo ────────────────────────
console.log('\n14ª luglio 2025 — stesso contratto, periodo di competenza diverso\n');
{
  const v = voce(q25, '003510');
  const s = contratto(q25, '003510');
  const orePiene = monthlyBaseGross(s) / s.hourlyRate;

  check('rateo: motore vs cedolino', extraMonthAccrual('quattordicesima', 2025, s), v.numeri[1] / orePiene, 0.001);
  check('  un solo mese su dodici', extraMonthAccrual('quattordicesima', 2025, s) * 12, 1, 0.001);
  check('  in ore', orePiene * extraMonthAccrual('quattordicesima', 2025, s), v.numeri[1], 0.01);
  check('  in euro', monthlyBaseGross(s) * extraMonthAccrual('quattordicesima', 2025, s), v.importo, 0.02);
  check('NON segue l’anno solare', extraMonthAccrual('quattordicesima', 2025, s) === extraMonthAccrual('tredicesima', 2025, s), false);
}

fine(TITOLO);
