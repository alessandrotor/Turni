// I tre popup fiscali del calendario: perché ogni mese è diverso, il
// conguaglio di dicembre, come funziona il trattamento integrativo.
//
// Stavano dentro CalendarView, che era arrivato a 2.211 righe; ora quel file
// non può più crescere (check-dimensioni.mjs). Qui non si calcola NIENTE: ogni
// cifra arriva già fatta dal calendario, che la prende dal motore. Un popup
// che rifà un conto per conto suo è il difetto che CLAUDE.md chiama «il motore
// è il cuore».

import { useRef } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import { formatCurrency } from '../utils/pay';
import { formatMonthYear } from '../utils/dates';
import { numeroIt, euroCella } from '../utils/formato';
import { tiMontanteNoto, irpefMontanteNota } from '../utils/conguaglio';
import { SOGLIA_RATEIZZAZIONE, POSIZIONE } from '../utils/restituzione';

// La cornice comune: velo, Esc, fuoco dentro, «Ho capito». Ognuno dei tre la
// ripeteva uguale.
function Finestra({ titolo, onChiudi, children }) {
  const ref = useRef(null);
  useModalDismiss(ref, onChiudi, true);
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="modal-header">
          <h2 className="modal-title">{titolo}</h2>
        </div>
        <div className="modal-form conti-bonus">
          {children}
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onChiudi}>
              Ho capito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// PERCHÉ OGNI MESE È DIVERSO. La regola del programma paghe (lordo del
// mese × 12, `tiSpettaQuestoMese`) e il suo effetto su QUESTO mese, con
// le righe e i nomi della busta. Le cifre sono quelle di `nettoDelMese`:
// le stesse del riquadro da cui si apre. Verificata su buste Zucchetti
// (check-ti-mensile.mjs): lo si dice, senza promettere che ogni
// programma paghe faccia uguale.
export function PopupMese({
  netMonth, currentMonth, conguaglio, meseSiInverte, forchettaScritta, tiNelMese, minimoTi, onChiudi, onApriConguaglio,
}) {
  return (
    <Finestra titolo="Perché ogni mese è diverso" onChiudi={onChiudi}>
      <p className="form-hint">
        Il datore non sa quanto guadagnerai: ogni mese fa i conti su lordo × 12
        (verificato sulle buste Zucchetti). Sotto 1.250 € al mese ti dà il tratt.
        integrativo; sopra lo toglie, ma alza la detrazione.
        {netMonth.esitoTi.senzaCapienza && <> Però serve IRPEF da compensare: sotto i
          ~{numeroIt(minimoTi ?? 0)} € al mese le detrazioni la azzerano già, e non spetta.</>}
      </p>
      <div className="net-group-label">
        {formatMonthYear(currentMonth)}: {numeroIt(netMonth.esitoTi.baseMese)} × 12
        = {numeroIt(netMonth.esitoTi.proiezione)} €
      </div>
      <div className="conti-bonus-righe">
        <div className="bonus-cifre"><span>IRPEF lorda</span><strong>{formatCurrency(netMonth.irpefLorda)}</strong></div>
        <div className="bonus-cifre"><span>Detrazioni lav. dip.</span><strong>−{formatCurrency(netMonth.detrazioniApplicate)}</strong></div>
        <div className="bonus-cifre bonus-cifre--totale"><span>Ritenute IRPEF</span><strong>{formatCurrency(netMonth.irpefNetta)}</strong></div>
        <div className="bonus-cifre"><span>Tratt. integrativo</span><strong>+{formatCurrency(netMonth.trattamentoIntegrativo)}</strong></div>
      </div>
      {/* DICEMBRE, di questo passo: quello che la tabella sopra mostra
          non è cosa fatta. Proiezione e saldo sono quelli del
          conguaglio (`stimaConguaglio`), non un conto rifatto qui. */}
      {conguaglio ? (
        <p className="form-hint">
          <strong>A dicembre, di questo passo</strong> il reddito dell&apos;anno
          fa {euroCella(conguaglio.centrale.redditoAnno)}, {conguaglio.centrale.annoSottoSoglia ? 'sotto' : 'sopra'} i
          15.000:{' '}
          {!meseSiInverte ? 'per questo mese niente da sistemare.'
            : tiNelMese
              ? 'il tratt. integrativo di questo mese te lo riprendono, l\'IRPEF in più te la ridanno.'
              : netMonth.esitoTi.senzaCapienza ? 'il tratt. integrativo di questo mese te lo ridanno.'
                : 'il tratt. integrativo di questo mese te lo ridanno, l\'IRPEF in meno se la riprendono.'}
          {' '}Sull&apos;anno {forchettaScritta}:{' '}
          <button type="button" className="linklike" onClick={() => { onApriConguaglio(); }}>vedi il conguaglio</button>.
        </p>
      ) : (
        <p className="form-hint">
          A dicembre il datore rifà i conti sull&apos;anno vero e sistema la
          differenza: è il conguaglio.
        </p>
      )}
    </Finestra>
  );
}

// IL CONGUAGLIO, per chi tocca «perché?». Tre registri, mai mescolati:
// il meccanismo all'indicativo, la cifra come forchetta, quello che
// l'app non sa accanto. Una frase per riga: deve stare in uno schermo.
export function PopupConguaglio({
  conguaglio, forchettaScritta, perchéConguaglio, settings, busteBozza, setBusteBozza, salvaBuste, finoA, onChiudi,
}) {
  return (
    <Finestra titolo="Il conguaglio di dicembre" onChiudi={onChiudi}>
      <p className="form-hint">
        A dicembre il datore ricalcola sull&apos;anno e sistema la differenza
        con le buste, non è una perdita. Di questo passo: <strong>{forchettaScritta}</strong>.
      </p>
      {/* LE DUE COLONNE da cui nasce ogni voce. «IRPEF −317 €» da solo
          non si capiva: di cosa è la differenza? Qui si legge. Le
          intestazioni ripetono le parole della frase sopra: «conto
          finale» si leggeva come «quello che pago a fine anno», che è
          invece la terza colonna. E mai «bonus» da solo: per chi ha un
          premio in busta, il bonus è quello. */}
      <table className="conguaglio-tabella">
        <thead>
          <tr><th /><th>Nelle {conguaglio.busteAnno} buste</th><th>Ricalcolato</th><th>A dicembre</th></tr>
        </thead>
        <tbody>
          {[['IRPEF', 'irpef', 1], ['Tratt. integrativo', 'trattamentoIntegrativo', -1],
            ['Indennità L. 207/24', 'indennita', -1]]
            .map(([nome, k, verso]) => ({ nome, k, verso, d: conguaglio.centrale.dettaglio[k], v: -conguaglio.centrale.voci[k] }))
            .filter(({ d, v }) => Math.abs(v) >= 1 || d.mesi >= 1)
            .map(({ nome, k, d, v }) => (
              <tr key={k}>
                <td>{nome}</td>
                <td>{euroCella(d.mesi)}</td>
                <td>{euroCella(d.anno)}</td>
                <td><strong>{Math.abs(v) < 1 ? '0 €' : `${v > 0 ? '+' : '−'}${euroCella(Math.abs(v))}`}</strong></td>
              </tr>
            ))}
          <tr className="conguaglio-tabella-saldo">
            <td colSpan={3}>
              Saldo: {conguaglio.centrale.saldo > 0 ? 'te li riprendono' : 'te li ridanno'}
            </td>
            <td><strong>{conguaglio.centrale.saldo > 0 ? '−' : '+'}{euroCella(Math.abs(conguaglio.centrale.saldo))}</strong></td>
          </tr>
        </tbody>
      </table>
      {perchéConguaglio && <p className="form-hint">{perchéConguaglio}</p>}
      {conguaglio.centrale.voci.trattamentoIntegrativo > SOGLIA_RATEIZZAZIONE && (
        <p className="form-hint">Il trattamento integrativo da restituire, oltre i 60 €, si paga a rate.</p>
      )}
      {/* LE CIFRE VERE, dove il modello non può saperle: i mesi del
          montante li conosce solo come totale. Facoltative, dentro il
          popup e mai altrove — chi non le scrive ha la stima. Stanno
          sulla stessa busta da cui viene il montante: «IRPEF pagata»
          fra i progressivi, il trattamento integrativo sommando le
          voci del mese. */}
      {conguaglio.meseMontante >= 0 && <div className="conguaglio-buste">{[
        ['irpefPagataMontante', `IRPEF pagata ${finoA(conguaglio.meseMontante)}`, irpefMontanteNota, conguaglio.centrale.irpefMesi],
        ['tiAccreditatoMontante', `Tratt. integrativo ${finoA(conguaglio.meseMontante)}`, tiMontanteNoto, conguaglio.centrale.tiMesi],
      ].map(([chiave, etichetta, noto, perMese]) => (
        <label key={chiave} className="bonus-cifre conguaglio-ti">
          <span>{etichetta}</span>
          <span className="conguaglio-ti-campo">
            <input
              type="number" inputMode="decimal" min="0" step="any"
              value={busteBozza[chiave] ?? (noto(settings) ?? '')}
              placeholder={numeroIt(Math.round(perMese
                .slice(0, conguaglio.meseMontante + 1).reduce((t, v) => t + v, 0)))}
              onChange={(e) => setBusteBozza((bz) => ({ ...bz, [chiave]: e.target.value }))}
              onBlur={() => salvaBuste(chiave)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            /> €
          </span>
        </label>
      ))}</div>}
      <p className="form-hint">
        {conguaglio.meseMontante < 0
          ? 'Non sappiamo quanto ti hanno accreditato davvero, altri redditi, figli e spese.'
          : 'Non sappiamo altri redditi, figli e spese.'}
        {conguaglio.mesiVuoti > 0 && ` ${conguaglio.mesiVuoti} ${conguaglio.mesiVuoti === 1 ? 'mese senza turni conta' : 'mesi senza turni contano'} come non lavorat${conguaglio.mesiVuoti === 1 ? 'o' : 'i'}.`}
        {' '}Più datori: col 730, l&apos;estate dopo.
      </p>
    </Finestra>
  );
}

// I CONTI DELLA SOGLIA, per chi tocca «perché?». Il pericolo da
// togliere è uno solo: considerare i ~100 € al mese già spesi.
// «Meno tasse e altre voci» non si scompone in detrazione (+1.145) e
// indennità 207/2024 (−~70): a schermo basta la somma, che esce dal
// motore (`costoSoglia`) e non da costanti scritte qui.
export function PopupSoglia({
  erogato, alTuoLordo, proiezione, costo, tabellaSoglia, posizione, mancaPareggio, onChiudi,
}) {
  return (
    <Finestra titolo="Come funziona il tratt. integrativo" onChiudi={onChiudi}>
      <p className="form-hint">
        Spetta fino a ~{euroCella(costo.tetto)} lordi l'anno (15.000 € di reddito): se li superi, a dicembre il datore si riprende
        tutto: {euroCella(erogato)} finora.
      </p>
      {/* La tabella è un'ALTRA grandezza rispetto alla cifra qui sopra:
          quella è cassa, questa è il saldo di un anno intero. Senza
          questa riga i due numeri sembrano lo stesso conto fatto male.
          Le righe stanno in un blocco loro per stringere gli spazi:
          il popup deve stare in uno schermo senza scorrere. */}
      {/* AL TUO LORDO, non nel punto peggiore. Chi è sotto la soglia
          vede cosa succederebbe superandola di poco (`costoSoglia`); chi
          è già dentro la fascia o oltre vede il SUO anno contro
          fermarsi al tetto (`confrontoConSoglia`): «−129 €» e «non
          perdi niente» nello stesso popup si contraddicevano, perché
          il primo era il caso peggiore e il secondo era lui.
          L'intestazione dice RISPETTO A COSA. */}
      <div className="net-group-label">
        {alTuoLordo
          ? `A ${euroCella(proiezione)}, rispetto a fermarti a ${euroCella(costo.tetto)}`
          : 'Se superassi i 15.000 di poco, in un anno'}
      </div>
      <div className="conti-bonus-righe">
        <div className="bonus-cifre">
          <span>Tratt. integrativo perso</span>
          <strong>{euroCella(tabellaSoglia.bonus)}</strong>
        </div>
        <div className="bonus-cifre">
          <span title={`detrazione ${numeroIt(tabellaSoglia.detrazioneSopra)} invece di ${numeroIt(tabellaSoglia.detrazioneSotto)}`}>
            Meno IRPEF (detrazione {numeroIt(tabellaSoglia.detrazioneSopra)})</span>
          <strong>+{euroCella(tabellaSoglia.tasse)}</strong>
        </div>
        {/* Il nome che la voce ha IN BUSTA («Indennit L.207/24» sui
            cedolini letti): «sconto sui contributi» spiegava cos'è ma
            non si poteva cercare sul cedolino, che è ciò che uno fa. */}
        <div className="bonus-cifre">
          <span>Indennità L. 207/24, che cala</span>
          <strong>{euroCella(tabellaSoglia.indennita)}</strong>
        </div>
        {alTuoLordo && (
          <div className="bonus-cifre">
            <span>Lavoro in più, netto di contributi</span>
            <strong>+{euroCella(tabellaSoglia.lavoro)}</strong>
          </div>
        )}
        <div className="bonus-cifre bonus-cifre--totale">
          <span><strong>{tabellaSoglia.totale >= 0 ? 'Ci guadagni' : 'Ci perdi'}</strong></span>
          <strong>{tabellaSoglia.totale > 0 ? '+' : ''}{euroCella(tabellaSoglia.totale)}</strong>
        </div>
      </div>
      {/* LA FASCIA MORTA, non la curva: la domanda vera è «mi conviene
          lavorare di più?». Solo a chi può ancora finirci dentro o ci
          sta; a chi è oltre la tabella sopra ha già risposto. */}
      {costo.larghezzaBuca > 0 && posizione !== POSIZIONE.OLTRE && (
        <p className="form-hint">
          {posizione === POSIZIONE.SOTTO ? (<>
            Solo in una fascia di lordo annuo: da {euroCella(costo.tetto)} perdi{' '}
            {euroCella(costo.perditaMax)}, poi risali e a {euroCella(costo.pareggio)} sei come
            prima. <strong>Tu, di questo passo ({euroCella(proiezione)}), sei sotto.</strong>
          </>) : (<>
            Sei nella fascia fino a {euroCella(costo.pareggio)} dove guadagnare di più non
            conviene: <strong>per tornare in pari mancano circa {euroCella(mancaPareggio)} lordi.</strong>
          </>)}
        </p>
      )}
      <p className="form-hint form-hint--warn">
        Con due datori ti riprendono di più.
      </p>
    </Finestra>
  );
}
