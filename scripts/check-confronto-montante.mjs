// Riscontro dell'avviso «il montante non torna coi turni»:
//
//   node scripts/check-confronto-montante.mjs
//
// Caso da cui nasce: montante 10.358 € (imponibile INPS dei progressivi della
// busta di agosto 2026, giusto al centesimo) contro 4.571 € di turni segnati
// in alcuni dei mesi coperti. L'avviso diceva «non torna» a dati corretti.
// Un mese senza turni non è un mese a zero: è un mese non segnato.

import { confrontoMontante } from '../src/utils/confronto-montante.js';
import { computePayByShift } from '../src/utils/pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const S = { hourlyRate: 9.21802, expectedWeeklyHours: 24, ccnl: 'turismo', aziendaDipendenti: 'oltre15',
  hasTredicesima: true, hasQuattordicesima: true, fixedMonthlyItems: [{ amount: 10 }] };
const turniDi = (mesi, fine = '15:00') => {
  const t = [];
  for (const m of mesi) for (let g = 1; g <= 22; g += 1) {
    const d = `2026-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
    t.push({ id: d, date: d, startTime: '10:00', endTime: fine });
  }
  return t;
};
const prova = (turni, settings) => confrontoMontante({ anno: 2026, settings, allShifts: turni, payMap: computePayByShift(turni, settings) });

console.log('\nQuando si confronta\n');
const parziali = turniDi([6, 7, 8]);
const conMontante = { ...S, priorTaxableIncome: 10358, priorIncomeDate: '2026-08-01' };
esito(prova(parziali, conMontante) === null, 'mesi coperti senza turni → nessun confronto, nessun avviso',
  'gennaio–maggio non segnati');

const tutti = turniDi([1, 2, 3, 4, 5, 6, 7, 8]);
const pieno = prova(tutti, { ...S, priorTaxableIncome: 1, priorIncomeDate: '2026-08-01' });
const lordo = pieno.lordoTurni;
const giusto = prova(tutti, { ...S, priorTaxableIncome: Math.round(lordo), priorIncomeDate: '2026-08-01' });
esito(giusto && !giusto.avvisa, 'tutti i mesi segnati e montante coerente → nessun avviso', `${Math.round(lordo)} €`);
// Il lordo del mese comprende 14ª e voci fisse, come il progressivo in busta:
// coi soli turni la 14ª da sola faceva quasi scattare l'avviso.
esito(lordo > pieno.mesi * 10, 'il confronto usa il lordo del mese (voci fisse, 14ª), non i soli turni');
const sbagliato = prova(tutti, { ...S, priorTaxableIncome: Math.round(lordo * 2), priorIncomeDate: '2026-08-01' });
esito(sbagliato?.avvisa, 'montante doppio dei mesi segnati → avviso');

console.log('\nL\'assunzione\n');
// Assunto a giugno: i mesi prima non esistono, e non devono bloccare il confronto.
const assunto = { ...S, hireDate: '2026-06-15', priorTaxableIncome: 1, priorIncomeDate: '2026-08-01' };
const daGiugno = prova(turniDi([6, 7, 8]), assunto);
esito(daGiugno && daGiugno.mesi === 3, 'assunto a giugno → si confrontano giugno–agosto', `${daGiugno?.mesi} mesi`);
esito(prova(tutti, { ...S, priorTaxableIncome: 5000, priorIncomeDate: '2025-08-01' }) === null,
  'montante di un altro anno → nessun confronto');

console.log();
if (falliti) { console.error(`${falliti} caso/i non tornano.`); process.exit(1); }
console.log('Tutti i casi tornano.');
