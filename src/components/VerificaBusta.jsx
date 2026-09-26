import { useState, useRef, useEffect } from 'react';
import { righeDaByte, inflateBrowser } from '../utils/cedolino';
import { leggiCedolinoDaRighe } from '../utils/leggi-cedolino';
import {
  confronta, confrontaAMano, testoDaCondividere, scartoScritto, spiegaScarto,
} from '../utils/verifica-busta';
import { formatCurrency } from '../utils/pay';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const oreDi = (n) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} h`;

// «Confronta con la busta»: il tester controlla da solo l'app contro il suo
// cedolino, e manda a chi sviluppa solo gli scarti.
//
// Si apre con `?verifica` e non compare da nessun'altra parte: è uno strumento
// per chi prova l'app, non una funzione in più per tutti.
//
// LA PROMESSA IN CIMA È VERA PER COSTRUZIONE, e va tenuta così: il PDF si legge
// in memoria (`cedolino.js`, con `DecompressionStream`), non si salva, e niente
// in questa pagina né nei moduli che usa parla con la rete. Il riscontro
// `check-verifica-busta.mjs` lo controlla: chi aggiungesse qui una chiamata di
// rete lo farebbe diventare rosso prima che la frase diventi falsa.

const meseScorso = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function VerificaBusta({ allShifts, settings, onChiudi }) {
  const [stato, setStato] = useState('attesa'); // attesa | lettura | fatto | illeggibile
  const [esito, setEsito] = useState(null);
  const [partTime, setPartTime] = useState(null);
  const [copiato, setCopiato] = useState(false);
  const [aMano, setAMano] = useState({ mese: meseScorso(), lordo: '', netto: '', ore: '' });
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const leggi = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStato('lettura');
    setEsito(null);
    try {
      const byte = new Uint8Array(await file.arrayBuffer());
      const fx = leggiCedolinoDaRighe(await righeDaByte(byte, inflateBrowser));
      if (!fx.voci.length || !fx.periodo) { setStato('illeggibile'); return; }
      setPartTime(fx.contratto?.partTimePct ?? null);
      setEsito(confronta(fx, { allShifts, settings }));
      setStato('fatto');
    } catch {
      setStato('illeggibile');
    }
  };

  const confrontaScritti = (e) => {
    e.preventDefault();
    const [anno, mese] = aMano.mese.split('-').map(Number);
    const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
    setPartTime(null);
    setEsito(confrontaAMano(
      { anno, mese: mese - 1, lordo: num(aMano.lordo), netto: num(aMano.netto), ore: num(aMano.ore) },
      { allShifts, settings },
    ));
    setStato('fatto');
  };

  const testo = esito
    ? testoDaCondividere(esito, { versione: __APP_VERSION__, settings, partTimePct: partTime })
    : '';

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiato(false), 2200);
    } catch { /* appunti non disponibili: resta «Condividi» */ }
  };
  const condividi = async () => {
    try { await navigator.share({ text: testo }); } catch { /* annullato */ }
  };

  const campo = (k) => (e) => setAMano((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="verifica">
      <div className="verifica-privacy" role="note">
        <strong>🔒 La tua busta paga NON viene inviata a nessun servizio esterno.</strong>
        <span>Viene letta qui, sul tuo telefono, e non viene salvata. Esce solo il testo che copi tu.</span>
      </div>

      <h1 className="verifica-titolo">Confronta con la busta</h1>

      <label className={`btn btn-primary verifica-scegli ${stato === 'lettura' ? 'is-busy' : ''}`}>
        {stato === 'lettura' ? '⏳ Leggo la busta…' : '📄 Scegli il PDF della busta'}
        <input type="file" accept="application/pdf,.pdf" onChange={leggi} hidden disabled={stato === 'lettura'} />
      </label>

      {stato === 'illeggibile' && (
        <form className="verifica-mano" onSubmit={confrontaScritti}>
          <p className="form-hint">
            Questa busta non riesco a leggerla (scansione o formato diverso). Scrivi tre numeri:
          </p>
          <div className="verifica-mano-campi">
            <label>Mese<input className="form-input" type="month" value={aMano.mese} onChange={campo('mese')} required /></label>
            <label>Imponibile INPS<input className="form-input" inputMode="decimal" value={aMano.lordo} onChange={campo('lordo')} required /></label>
            <label>Netto<input className="form-input" inputMode="decimal" value={aMano.netto} onChange={campo('netto')} required /></label>
            <label>Ore (se ci sono)<input className="form-input" inputMode="decimal" value={aMano.ore} onChange={campo('ore')} /></label>
          </div>
          <button type="submit" className="btn btn-secondary">Confronta</button>
        </form>
      )}

      {stato === 'fatto' && esito && (
        <>
          <table className="verifica-tabella">
            <tbody>
              {esito.righe.map((r) => (
                <tr key={`${r.livello}-${r.voce}`} className={r.ok ? 'is-ok' : 'is-scarto'}>
                  <td>{r.voce}</td>
                  <td className="verifica-scarto">{scartoScritto(r)}</td>
                  <td>{r.ok ? '✓' : '⚠️'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Da dove viene lo scarto del lordo. Un totale che non torna senza
              dire cosa lo compone non si può correggere: i motivi possibili
              sono sei, e dal totale non si distinguono. Qui le cifre ci sono
              tutte — restano sul telefono, nel testo da condividere no. */}
          {esito.scomposizione?.length > 0 && (() => {
            const lordo = esito.righe.find((r) => r.voce === 'Lordo');
            return (
              <section className="verifica-scomposizione">
                <h2>Da dove vengono i {scartoScritto(lordo)} di lordo</h2>
                <p className="form-hint">
                  È il lordo che l&apos;app ricava dai turni segnati {/^[aeiou]/.test(MESI[esito.periodo.mese]) ? 'ad' : 'a'} {MESI[esito.periodo.mese]}, contro
                  quello stampato in busta, diviso come lo divide il cedolino. «+» vuol dire che
                  l&apos;app conta di più.
                </p>
                {esito.scomposizione.map((r) => (
                  <div key={r.id} className={`verifica-voce ${r.ok ? 'is-ok' : 'is-scarto'}`}>
                    <div className="verifica-voce-testa">
                      <span>{r.voce}</span>
                      <span className="verifica-scarto">{scartoScritto(r)} {r.ok ? '✓' : '⚠️'}</span>
                    </div>
                    <div className="verifica-voce-cifre">
                      app {formatCurrency(r.app)}{r.oreApp ? ` (${oreDi(r.oreApp)})` : ''}
                      {' · '}busta {formatCurrency(r.busta)}{r.oreBusta != null ? ` (${oreDi(r.oreBusta)})` : ''}
                    </div>
                    {spiegaScarto(r) && <p className="verifica-voce-perche">{spiegaScarto(r)}</p>}
                  </div>
                ))}
              </section>
            );
          })()}
          {esito.avvisi.map((a) => <p key={a} className="form-hint">{a}</p>)}
          <div className="verifica-azioni">
            <button type="button" className="btn btn-primary" onClick={copia}>
              {copiato ? '✓ Copiato' : '📋 Copia il risultato'}
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button type="button" className="btn btn-secondary" onClick={condividi}>Condividi</button>
            )}
          </div>
          <p className="form-hint">Il testo contiene solo le differenze fra app e busta, senza importi.</p>
        </>
      )}

      <button type="button" className="linklike verifica-chiudi" onClick={onChiudi}>Torna al calendario</button>
    </div>
  );
}
