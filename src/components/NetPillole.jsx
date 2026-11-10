// Il passaggio dal lordo al netto, a riquadri: uno per voce, col nome della busta.
//
// Alcune voci ci sono o non ci sono, mese per mese: il premio (`monthlyBonus`)
// e il trattamento integrativo. Prima il premio era una casella sopra il netto
// («Prenderò il bonus di ottobre») e il trattamento compariva o spariva senza
// che si potesse chiedere «e se ci fosse?». Ora sono riquadri come gli altri,
// e si toccano: accesi o spenti li decide il motore (il premio, quello che hai
// segnato tu), un tocco prova il contrario. Spento non sparisce: resta al suo
// posto con la patina del non disponibile, così si vede che esiste.
//
// Il premio toccato si SALVA, come la casella di prima: è un dato che solo chi
// lo riceve conosce. Il trattamento toccato è una SIMULAZIONE, e lo dice: le
// regole che lo decidono stanno nel motore, e un tocco non le cambia.
//
// Sotto, il «Totale competenze» della busta (novembre 2026): il lordo non è la
// cifra che si trova in fondo al cedolino, e cercarla dava 50-150 € di scarto
// senza un perché. La somma non si scrive, si DISEGNA: le caselle che ne fanno
// parte hanno il bordo del colore della busta, e un filo da ciascuna scende al
// totale (`totaleCompetenze`, motore/competenze.js).
//
// Qui non si calcola niente: le cifre arrivano da `nettoDelMese`.

import { useLayoutEffect, useRef, useState } from 'react';
import { formatCurrency } from '../motore/pay';
import { totaleCompetenze } from '../motore/competenze';

const BUSTA = '#0891b2';
/** @type {import('react').CSSProperties} */
const BORDO = { outline: `2px solid ${BUSTA}`, outlineOffset: -1, position: 'relative', zIndex: 1 };
/** @type {import('react').CSSProperties} */
const SOPRA = { position: 'relative', zIndex: 1 };

function Mobile({ nome, cifra, attivo, simulato = false, onTocca, titolo, nelLordo = false, busta = false }) {
  return (
    <button
      type="button"
      data-busta={busta || undefined}
      style={busta ? BORDO : SOPRA}
      className={`net-pillola net-pillola--piu net-pillola--mobile${attivo ? '' : ' net-pillola--spenta'}`}
      aria-pressed={attivo}
      title={titolo}
      onClick={onTocca}
    >
      <span className="net-pillola-nome">{nome}</span>
      <span className="net-pillola-cifra">{nelLordo ? '' : '+'}{formatCurrency(cifra)}</span>
      {/* Solo acceso: spento, la patina dice già tutto, e «simulato» sotto una
          cifra barrata era una scritta in più da leggere. */}
      {simulato && attivo && <span className="net-pillola-sim">simulato</span>}
      {nelLordo && <span className="net-pillola-sim">nel lordo</span>}
    </button>
  );
}

// Il premio da solo: il riepilogo lo usa nei mesi senza turni, dove il netto non c'è.
export function PillolaPremio({ importo, preso, onTocca }) {
  return (
    <Mobile nome="Bonus" cifra={importo} attivo={preso} onTocca={onTocca} nelLordo
      titolo={preso ? 'Tocca se questo mese non lo prendi' : 'Tocca se questo mese lo prendi'} />
  );
}

// I fili: da sotto ogni casella bordata al totale. Si misurano dopo il disegno,
// perché le caselle vanno a capo secondo la larghezza; il filo passa DIETRO le
// caselle (stanno sopra), così da una casella della prima riga esce sotto quella
// della seconda.
function useFili(contenitore, totale, chiave) {
  const [fili, setFili] = useState(/** @type {string[]} */ ([]));
  useLayoutEffect(() => {
    const c = contenitore.current, t = totale.current;
    if (!c || !t) return undefined;
    const misura = () => {
      const r = c.getBoundingClientRect(), rt = t.getBoundingClientRect();
      const tx = rt.left + rt.width / 2 - r.left, ty = rt.top - r.top;
      setFili([...c.querySelectorAll('[data-busta]')].map((el) => {
        const e = el.getBoundingClientRect();
        const x = e.left + e.width / 2 - r.left, y = e.bottom - r.top;
        const m = (ty - y) / 2;
        return `M${x} ${y} C${x} ${y + m} ${tx} ${ty - m} ${tx} ${ty - 2}`;
      }));
    };
    misura();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(misura) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, [contenitore, totale, chiave]);
  return fili;
}

export default function NetPillole({
  lordo, net, effectiveRatePct, tfr,
  bonusImporto, bonusPreso, onBonus,
  tiAttivo, tiSimulato, tiCifra, onTi,
}) {
  const contenitore = useRef(null);
  const totale = useRef(null);
  const busta = totaleCompetenze(net);
  const fili = useFili(contenitore, totale, `${busta.totale}|${tiAttivo}|${bonusImporto}|${bonusPreso}`);
  return (
    <div ref={contenitore} style={{ position: 'relative' }}>
    <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
      {fili.map((d) => <path key={d} d={d} fill="none" stroke={BUSTA} strokeWidth={2} />)}
    </svg>
    <div className="net-pillole">
      {/* Il premio sta PRIMA del lordo, perché ne fa parte: dopo le trattenute,
          con un «+», si leggeva come un'aggiunta al netto, contato due volte. */}
      {bonusImporto > 0 && <PillolaPremio importo={bonusImporto} preso={bonusPreso} onTocca={onBonus} />}
      <span className="net-pillola" data-busta style={BORDO}>
        <span className="net-pillola-nome">Lordo</span>
        <span className="net-pillola-cifra">{formatCurrency(lordo)}</span>
      </span>
      <span className="net-pillola" style={SOPRA} title={`${effectiveRatePct.toFixed(1)}% del lordo`}>
        <span className="net-pillola-nome">Trattenute</span>
        <span className="net-pillola-cifra">−{formatCurrency(net.trattenute)}</span>
      </span>
      {tiCifra > 0 && (
        <Mobile nome="Tratt. integrativo" cifra={tiCifra} attivo={tiAttivo} simulato={tiSimulato} onTocca={onTi} busta={tiAttivo}
          titolo={tiSimulato ? 'Simulazione: tocca per tornare al calcolo' : 'Tocca per simulare il contrario'} />
      )}
      {net.bonusCuneo > 0 && (
        <span className="net-pillola net-pillola--piu" data-busta style={BORDO}>
          <span className="net-pillola-nome">Indennità L. 207/24</span>
          <span className="net-pillola-cifra">+{formatCurrency(net.bonusCuneo)}</span>
        </span>
      )}
      {tfr > 0 && (
        <span className="net-pillola net-pillola--piu" style={SOPRA}>
          <span className="net-pillola-nome">TFR</span>
          <span className="net-pillola-cifra">+{formatCurrency(tfr)}</span>
        </span>
      )}
    </div>
    {/* Il totale della busta: lo stesso nome del cedolino, da cercarci. */}
    <div ref={totale} style={{ position: 'relative', zIndex: 1, margin: '1.6rem auto .2rem', width: 'fit-content', padding: '.3rem .9rem',
      borderRadius: 'var(--radius-sm)', background: BUSTA, color: '#fff', textAlign: 'center' }}>
      <span style={{ display: 'block', fontSize: '.72rem', opacity: .9 }}>In busta: Totale competenze</span>
      <strong style={{ fontSize: '1rem' }}>{formatCurrency(busta.totale)}</strong>
    </div>
    </div>
  );
}
