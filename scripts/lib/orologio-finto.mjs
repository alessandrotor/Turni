// Orologio spostato per i riscontri: `node --import ./scripts/lib/orologio-finto.mjs`
// con OGGI_FINTO=2026-12-31T10:00. `new Date()` e `Date.now()` rispondono quel
// giorno; `new Date(…)` con argomenti resta com'è.
//
// Serve a `riscontri.mjs`: un riscontro che passa a settembre e fallisce il
// primo ottobre non dice niente del motore, dice che il riscontro leggeva
// l'orologio. È già capitato due volte (check-proiezione, check-montante-
// mensilita), e nessuno se n'era accorto finché il mese non è cambiato.

const finta = new Date(process.env.OGGI_FINTO).getTime();
if (Number.isNaN(finta)) throw new Error('OGGI_FINTO non è una data');
const Vera = Date;
class Finta extends Vera {
  constructor(...a) { if (a.length === 0) super(finta); else super(...a); }
  static now() { return finta; }
}
globalThis.Date = Finta;
