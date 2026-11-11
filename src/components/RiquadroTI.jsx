// Il riquadro del trattamento integrativo, sotto il calendario. Novembre 2026: aveva una
// decina di cifre a vista (margine in euro e in ore, già preso, soglia lorda, 15.000,
// finora, a dicembre, di nuovo la soglia, la forchetta del conguaglio, il premio) e «si fa
// confusione». Ora, scelto sui mockup con chi mantiene il progetto:
//  1) una risposta in grande con la sua piastrella (di solito: quante ore restano);
//  2) la barra, con «oggi», «a dicembre» e «soglia» a parole: il disegno dice dove sei;
//  3) le altre risposte su righe, ognuna con la sua piastrella e un numero solo, dello
//     stesso colore della zona della barra di cui parla (rosso oltre la soglia);
//  4) il resto (soglia in euro, cifre della barra, simulazione del premio) in «Dettagli».
// Qui non si calcola niente: ogni cifra arriva dal calendario, che la prende dal motore.

import { formatCurrency } from '../motore/pay';
import { euroCella, scriviForchetta, numeroIt } from '../utils/formato';
import { BONUS_STATUS, margineInOre } from '../motore/bonus';
import { CAUSA, POSIZIONE } from '../motore/restituzione';
import { tiSospeso, patchTiSospeso } from '../motore/net';
import Icona from './Icona';

function Sospendi({ settings, onUpdateSettings }) {
  return (
    <label className="check-row bonus-rischio-scelta">
      <input
        type="checkbox"
        checked={tiSospeso(settings)}
        onChange={(e) => onUpdateSettings(patchTiSospeso(e.target.checked))}
      />
      <span>Chiedi al datore di sospenderlo, poi spunta qui</span>
    </label>
  );
}

const VERDE = '#059669', ARANCIO = '#d97706', ROSSO = '#dc2626', GRIGIO = '#64748b';

// La risposta principale, in grande, con la sua piastrella.
function Grande({ icona, colore, children, sotto = null }) {
  return (
    <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', margin: '.4rem 0 .2rem' }}>
      <span style={{ fontSize: '1.45rem', lineHeight: 1 }}><Icona nome={icona} piastrella colore={colore} /></span>
      <div>
        <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.15 }}>{children}</div>
        {sotto && <div className="bonus-strip-note" style={{ margin: 0 }}>{sotto}</div>}
      </div>
    </div>
  );
}

// Una riga: piastrella, cosa è (e quando), un numero solo a destra.
function Riga({ icona, colore, titolo, sotto, valore, onClick = null }) {
  const contenuto = (
    <>
      <span style={{ fontSize: '1.3rem', lineHeight: 1 }}><Icona nome={icona} piastrella colore={colore} /></span>
      <span style={{ flex: 1, textAlign: 'left' }}>{titolo}<small style={{ display: 'block', color: 'var(--c-text-2)', fontSize: '.78rem' }}>{sotto}</small></span>
      <strong style={{ color: colore, fontSize: '1.05rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{valore}{onClick ? ' ›' : ''}</strong>
    </>
  );
  /** @type {import('react').CSSProperties} */
  const stile = { display: 'flex', gap: '.6rem', alignItems: 'center', width: '100%', padding: '.55rem 0', borderTop: '1px solid var(--c-border)', background: 'none', border: 'none', borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: 'var(--c-border)', font: 'inherit', color: 'inherit' };
  return onClick
    ? <button type="button" onClick={onClick} style={{ ...stile, cursor: 'pointer' }}>{contenuto}</button>
    : <div style={stile}>{contenuto}</div>;
}

// «Se la superi», come bilancia (mockup A, novembre 2026). Accanto a «ti ridanno 90 €»,
// «700 € da restituire» sembrava una contraddizione, e una perdita. Non lo è: superata la
// soglia il tratt. integrativo sparisce ma la detrazione sale, e le tasse calano quasi
// altrettanto. Due barre che si pesano: il pezzo a righe che resta scoperto è la perdita
// vera (`costoSoglia`). Cifre sull'anno intero, tutte dal motore.
function Bilancia({ costo, titolo, ore }) {
  const perso = -costo.voci.bonus;
  const compensa = perso - costo.perditaMax;
  const quota = `${Math.max(0, Math.min(100, (compensa / perso) * 100))}%`;
  const barra = { height: '.8rem', borderRadius: 4, margin: '.15rem 0 .45rem' };
  const riga = { display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.85rem' };
  const righe = `repeating-linear-gradient(45deg, #fee2e2 0 4px, #fca5a5 4px 7px)`;
  return (
    <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '.55rem', marginTop: '.2rem' }}>
      <div style={{ fontSize: '.75rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: GRIGIO, marginBottom: '.3rem' }}>{titolo}</div>
      <div style={riga}><span>Perdi il tratt. integrativo</span><strong style={{ color: ROSSO }}>−{euroCella(perso)}</strong></div>
      <div style={{ ...barra, background: ROSSO }} />
      <div style={riga}><span>Ma paghi meno tasse</span><strong style={{ color: VERDE }}>+{euroCella(compensa)}</strong></div>
      <div style={{ ...barra, display: 'flex', overflow: 'hidden' }}>
        <span style={{ width: quota, background: VERDE }} />
        <span style={{ flex: 1, background: righe, boxShadow: `inset 0 0 0 1.5px ${ROSSO}` }} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <strong style={{ color: ROSSO, fontSize: '1.05rem' }}>Alla fine ci perdi al massimo {euroCella(costo.perditaMax)}</strong>
        {ore > 0 && <small style={{ display: 'block', color: 'var(--c-text-2)', fontSize: '.78rem' }}>e bastano ~{ore} ore in più per recuperarli</small>}
      </div>
    </div>
  );
}

// Il saldo del conguaglio dalla parte di chi legge: + ti danno, − ti tolgono
// (nel motore è il contrario: positivo = a debito). Arrotondato alla decina,
// come la forchetta scritta.
function saldoConSegno({ min, max }) {
  const dieci = (n) => Math.round(n / 10) * 10;
  const [a, b] = [dieci(-max), dieci(-min)]; // a ≤ b
  const s = (n) => (n > 0 ? `+${numeroIt(n)}` : n < 0 ? `−${numeroIt(-n)}` : '0');
  if (a === b) return `${s(a)} €`;
  if (a === 0 || b === 0) return `fino a ${s(a || b)} €`;
  if (a > 0) return `+${numeroIt(a)}–${numeroIt(b)} €`;
  if (b < 0) return `−${numeroIt(-b)}–${numeroIt(-a)} €`;
  return `${s(a)} / ${s(b)} €`;
}

// Oltre la soglia, la busta di dicembre ha DUE righe: il tratt. integrativo
// ripreso e le tasse rese (la detrazione sale). «Niente da restituire» diceva
// il saldo e taceva la trattenuta, che poi in busta c'è (novembre 2026). Due
// tasselli lunghi quanto valgono, una freccia che esce e una che entra, e il
// saldo accanto: le cifre sono le voci del conguaglio (`stimaConguaglio`).
function Dicembre({ ripreso, reso, saldo, colore, onApri, stima, onCopia }) {
  const tassello = (v, sfondo, raggio, allinea) => ({ flex: Math.max(1, v), minWidth: 0, background: sfondo, borderRadius: raggio,
    padding: '.35rem .5rem', color: '#fff', textAlign: allinea, lineHeight: 1.15 });
  const nome = { display: 'flex', alignItems: 'center', gap: '.25rem', fontSize: '.7rem', opacity: .92, whiteSpace: 'nowrap' };
  return (
    <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '.55rem', marginTop: '.2rem' }}>
      <div style={{ fontSize: '.75rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: GRIGIO, marginBottom: '.35rem' }}>A dicembre, di questo passo</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
        <div style={{ flex: 1, display: 'flex', gap: 3, minWidth: 0 }}>
          <div style={tassello(ripreso, `linear-gradient(180deg, #ef4444, ${ROSSO})`, '12px 4px 4px 12px', 'left')}>
            <span style={nome}><Icona nome="carica" colore="#fff" /> tratt. int.</span>
            <strong style={{ fontSize: '1rem' }}>−{euroCella(ripreso)}</strong>
          </div>
          <div style={tassello(reso, `linear-gradient(180deg, #10b981, ${VERDE})`, '4px 12px 12px 4px', 'right')}>
            <span style={{ ...nome, justifyContent: 'flex-end' }}>tasse <Icona nome="dicembre" colore="#fff" /></span>
            <strong style={{ fontSize: '1rem' }}>{reso >= 0 ? '+' : '−'}{euroCella(Math.abs(reso))}</strong>
          </div>
        </div>
        <span style={{ color: GRIGIO, fontWeight: 800 }}>=</span>
        <button type="button" onClick={onApri} style={{ font: 'inherit', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
          color: colore, background: `${colore}14`, border: `1.5px solid ${colore}`, borderRadius: 999, padding: '.3rem .7rem' }}>
          {saldo} ›
        </button>
      </div>
      {stima && (
        <p className="bonus-strip-note" style={{ margin: '.4rem 0 0' }}>
          Il tratt. integrativo preso è una stima.{' '}
          <button type="button" className="linklike" onClick={onCopia}>Copia dalle buste quello che hai preso</button>
        </p>
      )}
    </div>
  );
}

export default function RiquadroTI({
  bonus, rischio, posizione, costo, mancaPareggio, mancaOre, tiFinora, annualGross,
  settings, onUpdateSettings, onPerche, avvisoMontante,
  conguaglio, forchettaScritta, onApriConguaglio,
  puoSimulareBonus, simulaBonus, setSimulaBonus, monthlyBonusAmount,
  proiezioneBonusOgniMese, differenzaBonus, esitoSimulazione, conguaglioSimulato,
}) {
  const perche = <button type="button" className="linklike" onClick={onPerche}>perché?</button>;
  // Le voci del conguaglio: positivo = te lo riprendono, negativo = te lo rendono.
  const voci = conguaglio?.centrale?.voci;
  const ripreso = voci ? Math.max(0, voci.trattamentoIntegrativo) : 0;
  const reso = voci ? -(voci.irpef + voci.indennita) : 0;
  const dicembre = posizione === POSIZIONE.OLTRE && rischio.causa !== CAUSA.RINUNCIATO && ripreso >= 1;
  // Il bonus preso si può copiare dalle buste solo per i mesi del montante.
  const daCopiare = conguaglio && conguaglio.tiMontanteNoto == null && conguaglio.meseMontante >= 0;
  const tetto = bonus.thresholdFullGross;
  const sospeso = rischio.causa === CAUSA.RINUNCIATO;
  const vicino = bonus.status === BONUS_STATUS.PIENO && bonus.nearThreshold;
  const quanto = (euro, ore) => (ore !== null && ore !== undefined ? `~${ore} ore` : euroCella(euro));

  // 1) LO STATO: un titolo breve e la risposta in grande. I tre casi non sono tre intensità
  // dello stesso allarme (vedi `costoSoglia`); la cassa che torna indietro si dice come cassa.
  let titolo, tono, grande = null, sospendi = false;
  if (sospeso) {
    titolo = 'sospeso'; tono = GRIGIO;
    grande = (
      <p className="ti-stato">
        Segnato come sospeso: niente da restituire.{' '}
        <button type="button" className="linklike" onClick={() => onUpdateSettings(patchTiSospeso(false))}>Annulla</button>
      </p>
    );
  } else if (posizione === POSIZIONE.OLTRE) {
    titolo = rischio.daRestituire > 0 ? 'supererai la soglia' : 'oltre la soglia'; tono = rischio.daRestituire > 0 ? ROSSO : VERDE;
    sospendi = rischio.daRestituire > 0;
    if (dicembre) grande = null;
    else if (rischio.daRestituire > 0) {
      grande = (
        <Grande icona="restituisci" colore={ROSSO}
          sotto={<>presi in più in busta, non persi: paghi meno IRPEF{rischio.rateizzabile ? '. A rate' : ''}. {perche}</>}>
          {euroCella(rischio.daRestituire)} a dicembre
        </Grande>
      );
    } else {
      // «Niente» solo se davvero non l'hai mai avuto: la stima dei mesi del montante
      // può sbagliare, e la busta di luglio 2026 lo aveva.
      grande = (
        <p className="ti-stato">
          Niente da restituire{daCopiare ? <>, se nelle buste non l'hai mai avuto.{' '}
            <button type="button" className="linklike" onClick={onApriConguaglio}>L'hai avuto?</button></> : '.'}
        </p>
      );
    }
  } else if (posizione === POSIZIONE.DENTRO) {
    titolo = 'appena sopra la soglia'; tono = ARANCIO; sospendi = rischio.daRestituire > 0;
    grande = (
      <Grande icona="orologio" colore={ARANCIO} sotto={<>per tornare in pari. {perche}</>}>
        ancora {quanto(mancaPareggio, mancaOre)}
      </Grande>
    );
  } else if (bonus.status === BONUS_STATUS.PIENO) {
    titolo = vicino ? 'sei vicino alla soglia' : 'resti sotto la soglia'; tono = vicino ? ARANCIO : VERDE;
    sospendi = vicino;
    grande = bonus.marginToFull > 0 && (
      <Grande icona="orologio" colore={tono} sotto={<>prima della soglia, in tutto l'anno. {perche}</>}>
        ancora {quanto(bonus.marginToFull, bonus.oreResidue)}
      </Grande>
    );
  } else {
    titolo = 'non spetta'; tono = GRIGIO;
    grande = <p className="ti-stato">Oltre i 28.000 € di reddito il tratt. integrativo non spetta.</p>;
  }

  // 2) LA BARRA, in LORDO: la soglia è di reddito, la barra la mostra nel lordo che
  // corrisponde (`tetto`). Le etichette a parole; le cifre stanno nei Dettagli.
  const scala = Math.max(tetto * 1.15, bonus.income, annualGross);
  const pct = (v) => `${Math.min(100, Math.max(0, (v / scala) * 100))}%`;
  const classe = posizione === POSIZIONE.OLTRE ? 'oltre' : (posizione === POSIZIONE.DENTRO || vicino) ? 'vicino' : 'sotto';
  const zonaRossa = `repeating-linear-gradient(45deg, #fee2e2 0 4px, #fca5a5 4px 7px)`;

  // 3) LE ALTRE RISPOSTE, una riga ciascuna.
  // Il costo del superarla si mostra a chi ci è vicino: a 300 ore di distanza è un allarme fuori luogo.
  const daRestituire = posizione === POSIZIONE.DENTRO ? rischio.daRestituire : (vicino ? tiFinora : 0);
  const bilancia = !sospeso && (vicino || posizione === POSIZIONE.DENTRO) && costo?.perditaMax > 0 && costo.voci?.bonus < 0;
  const cong = conguaglio && {
    titolo: conguaglio.direzione === 'credito' ? 'Ti ridanno' : conguaglio.direzione === 'debito' ? 'Ti riprendono' : 'Conguaglio',
    colore: conguaglio.direzione === 'credito' ? VERDE : conguaglio.direzione === 'debito' ? ROSSO : GRIGIO,
    valore: forchettaScritta.replace(/^ti (ridanno|riprendono) /, ''),
  };

  return (
    <div className="bonus-strip">
      <div className="bonus-strip-head">
        <span className="bonus-strip-title" style={{ color: tono }}>
          <Icona nome={tono === VERDE ? 'ok' : 'avviso'} colore={tono} /> Tratt. integrativo: {titolo}
        </span>
      </div>

      {grande}

      {tetto > 0 && !sospeso && (
        <div className={`ti-barra ti-barra--${classe}`} role="img"
          aria-label={`Guadagnato finora ${euroCella(annualGross)}, previsto a dicembre ${euroCella(bonus.income)}, soglia ${euroCella(tetto)} lordi`}>
          <div className="ti-barra-binario">
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(tetto), right: 0, background: zonaRossa }} />
            <span className="ti-barra-previsto" style={{ width: pct(Math.max(bonus.income, annualGross)) }} />
            <span className="ti-barra-maturato" style={{ width: pct(annualGross) }} />
            <span className="ti-barra-soglia" style={{ left: pct(tetto) }} />
          </div>
          <div style={{ position: 'relative', height: '1.1rem', fontSize: '.75rem', color: 'var(--c-text-2)' }}>
            {/* Le parole si scrivono solo dove c'è posto: vicine alla soglia si sovrapponevano. */}
            {Math.abs(annualGross - tetto) / scala > 0.1 && (
              <span style={{ position: 'absolute', left: pct(annualGross), transform: 'translateX(-100%)', whiteSpace: 'nowrap' }}>oggi</span>
            )}
            {(bonus.income - annualGross) / scala > 0.08 && Math.abs(bonus.income - tetto) / scala > 0.08 && bonus.income / scala < 0.92 && (
              <span style={{ position: 'absolute', left: pct(bonus.income), transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>dic.</span>
            )}
            <span style={{ position: 'absolute', left: pct(tetto), padding: '0 4px', transform: tetto / scala > 0.85 ? 'translateX(-100%)' : 'none', color: ROSSO, fontWeight: 700, whiteSpace: 'nowrap' }}>soglia</span>
          </div>
        </div>
      )}

      {/* Prima «di questo passo», poi «se la superi»: due situazioni, due titoli. */}
      {dicembre && cong && (
        <Dicembre ripreso={ripreso} reso={reso} saldo={saldoConSegno(conguaglio)}
          colore={cong.colore} onApri={onApriConguaglio} stima={daCopiare} onCopia={onApriConguaglio} />
      )}
      {cong && !dicembre && (
        <Riga icona="dicembre" colore={cong.colore} titolo={cong.titolo} sotto="a dicembre, di questo passo"
          valore={cong.valore} onClick={onApriConguaglio} />
      )}
      {bilancia && (
        <Bilancia costo={costo} titolo={posizione === POSIZIONE.DENTRO ? 'Perché ci perdi poco' : 'Se la superi'}
          ore={margineInOre(costo.larghezzaBuca, settings)} />
      )}
      {!sospeso && daRestituire > 0 && !bilancia && (
        <Riga icona="restituisci" colore={ROSSO} titolo={posizione === POSIZIONE.DENTRO ? 'Torna indietro' : 'Se la superi'}
          sotto="da restituire a dicembre" valore={euroCella(daRestituire)} />
      )}

      {sospendi && <Sospendi settings={settings} onUpdateSettings={onUpdateSettings} />}
      {avvisoMontante}

      {/* 4) I DETTAGLI: la soglia in euro (prima il lordo, poi i 15.000 di ogni guida),
          le cifre della barra e la simulazione del premio, che affianca e non sostituisce. */}
      {!sospeso && (
        <details style={{ marginTop: '.5rem' }}>
          <summary className="bonus-strip-note" style={{ cursor: 'pointer' }}>Dettagli</summary>
          {tetto > 0 && (
            <p className="ti-soglia">
              La tua soglia lorda è <strong>~{euroCella(tetto)}</strong> l'anno
              {' '}<span className="soglia-lorda">(15.000 € di reddito, cioè lordo meno contributi{
                Number(settings.fondoPensionePct) || Number(settings.cassaSanitariaEuro) ? ' e fondi' : ''})</span>.
            </p>
          )}
          {tetto > 0 && (
            <div className={`ti-legenda ti-barra ti-barra--${classe}`} style={{ margin: '.4rem 0 0' }}>
              <span><i className="ti-segno" />finora {euroCella(annualGross)}</span>
              <span><i className="ti-segno ti-segno--previsto" />a dicembre {euroCella(bonus.income)}</span>
              <span><i className="ti-segno ti-segno--soglia" />soglia {euroCella(tetto)}</span>
            </div>
          )}
          {bilancia && daRestituire > 0 && (
            <p className="bonus-strip-note">
              Dei {euroCella(-costo.voci.bonus)} di tratt. integrativo, {euroCella(daRestituire)} li hai già presi:
              se la superi li ridai a dicembre, e lo stesso conguaglio ti rende le tasse in più.
            </p>
          )}
          {puoSimulareBonus && (
            <div className="simula-bonus">
              <label className="check-row" htmlFor="simula-bonus">
                <input id="simula-bonus" type="checkbox" checked={simulaBonus} onChange={(e) => setSimulaBonus(e.target.checked)} />
                <span>E se prendessi i {formatCurrency(monthlyBonusAmount)} <strong>tutti i mesi</strong> da qui a dicembre?</span>
              </label>
              {simulaBonus && (
                <p className="simula-bonus-esito">
                  <span>A dicembre <strong>{euroCella(proiezioneBonusOgniMese.value)}</strong>{' '}
                    <span className="simula-bonus-delta">(+{euroCella(differenzaBonus)})</span></span>
                  {esitoSimulazione && (
                    <strong className={`simula-bonus-ti simula-bonus-ti--${esitoSimulazione.tono}`}>{esitoSimulazione.testo}</strong>
                  )}
                  {conguaglioSimulato && (
                    <span className="simula-bonus-conguaglio">
                      Conguaglio: <strong>{scriviForchetta(conguaglioSimulato)}</strong> (adesso: {forchettaScritta}).
                      {' '}Solo una simulazione.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </details>
      )}
    </div>
  );
}
