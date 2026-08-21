// Caricamento delle fixture dei cedolini per i riscontri.
//
// Le fixture NON stanno nel repository (vedi `scripts/leggi-cedolini.mjs`): un
// computer che non ha i PDF personali non ce le ha. Un riscontro che in quel
// caso fallisse direbbe il falso — non e' rotto niente, mancano solo i dati —
// e una suite che va in rosso per un motivo che non e' un guasto smette di
// essere guardata.
//
// Quindi: se la fixture manca, il riscontro si SALTA dicendolo, e con l'uscita
// zero.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CARTELLA = 'dati-buste';

export function fixture(slug) {
  const p = join(CARTELLA, `${slug}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Carica le fixture richieste, oppure spiega perche' si salta e chiude con 0.
 * Da usare come prima riga di un riscontro sui cedolini.
 */
export function fixtureOSalta(titolo, ...slug) {
  const trovate = slug.map((s) => [s, fixture(s)]);
  const mancanti = trovate.filter(([, f]) => !f).map(([s]) => s);
  if (mancanti.length) {
    console.log(`\n${titolo}`);
    console.log(`  SALTATO — mancano le fixture: ${mancanti.join(', ')}`);
    console.log('  Rigenerale dai PDF personali con:');
    console.log('    node scripts/leggi-cedolini.mjs "<cartella dei cedolini>"\n');
    process.exit(0);
  }
  return trovate.map(([, f]) => f);
}

export const voce = (fx, codice) => fx.voci.find((v) => v.codice === codice) || null;
export const vociCome = (fx, re) => fx.voci.filter((v) => re.test(v.etichetta || ''));

/** Il confronto standard dei riscontri sulle buste. */
export function confronto() {
  let falliti = 0, totale = 0;
  const check = (label, avuto, atteso, tol = 0.005) => {
    totale += 1;
    const ok = typeof atteso === 'number'
      ? typeof avuto === 'number' && Math.abs(avuto - atteso) <= tol
      : avuto === atteso;
    if (!ok) falliti += 1;
    const f = (n) => (typeof n === 'number' ? n.toFixed(2).padStart(10) : String(n).padStart(10));
    const delta = (typeof atteso === 'number' && typeof avuto === 'number')
      ? `  Δ ${(avuto - atteso).toFixed(2)}` : '';
    console.log(`  ${ok ? 'ok  ' : 'DIFF'} ${label.padEnd(36)} atteso ${f(atteso)} → ${f(avuto)}${delta}`);
  };
  const fine = (titolo) => {
    console.log('');
    if (falliti) {
      console.log(`${falliti} differenze su ${totale} in «${titolo}».`);
      console.log('Una differenza non vuol dire che il motore sbagli: puo’ essere');
      console.log('politica aziendale, o ore registrate diverse. Va classificata.\n');
      process.exit(1);
    }
    console.log(`Tutti i ${totale} valori tornano.\n`);
    return 0;
  };
  return { check, fine };
}
