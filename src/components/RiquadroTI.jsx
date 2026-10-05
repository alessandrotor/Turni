// Il riquadro del trattamento integrativo, sotto il calendario.
//
// Stava dentro CalendarView, ed era la parte più affollata della schermata:
// margine, barra, previsto, maturato, montante, conguaglio e simulazione, sette
// cose di fila senza una gerarchia. Chi lo apriva leggeva «Margine prima della
// soglia: 1.005 €» con la barra verde e nessun avviso, e capiva che col
// prossimo stipendio sarebbe stato fuori: il margine era sull'ANNO, ma non lo
// diceva. E la soglia stava solo come etichetta sotto la barra.
//
// L'ordine ora è quello delle domande: 1) sto sotto o sopra? 2) cos'è la
// soglia, per me? 3) dove sono sulla barra? 4) cosa succede a dicembre?
// 5) e se prendessi il premio tutti i mesi? Una risposta per riga.
//
// Qui non si calcola niente: ogni cifra arriva dal calendario, che la prende
// dal motore (CLAUDE.md, «il motore è il cuore»).

import { formatCurrency } from '../utils/pay';
import { euroCella, scriviForchetta } from '../utils/formato';
import { BONUS_STATUS } from '../utils/bonus';
import { CAUSA, POSIZIONE } from '../utils/restituzione';
import { tiSospeso, patchTiSospeso } from '../utils/net';

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

export default function RiquadroTI({
  bonus, rischio, posizione, costo, mancaPareggio, mancaOre, tiFinora, annualGross,
  settings, onUpdateSettings, onPerche, avvisoMontante,
  conguaglio, forchettaScritta, onApriConguaglio,
  puoSimulareBonus, simulaBonus, setSimulaBonus, monthlyBonusAmount,
  proiezioneBonusOgniMese, differenzaBonus, esitoSimulazione, conguaglioSimulato,
}) {
  const perche = <button type="button" className="linklike" onClick={onPerche}>perché?</button>;
  const tetto = bonus.thresholdFullGross;

  // 1) LO STATO, in una riga. I tre casi non sono tre intensità dello stesso
  // allarme (vedi `costoSoglia`): sotto si dice il margine, dentro la buca
  // quanto manca al pari, oltre che non si perde niente. La cassa — il
  // trattamento già preso che torna indietro — si dice come cassa.
  let stato;
  if (rischio.causa === CAUSA.RINUNCIATO) {
    stato = (
      <p className="ti-stato">
        Hai segnato il trattamento integrativo come sospeso: niente da restituire.{' '}
        <button type="button" className="linklike" onClick={() => onUpdateSettings(patchTiSospeso(false))}>Annulla</button>
      </p>
    );
  } else if (posizione === POSIZIONE.OLTRE) {
    stato = rischio.daRestituire > 0 ? (
      <div className="bonus-rischio bonus-rischio--anteprima">
        <span className="bonus-rischio-titolo">⚠️ Supererai la soglia</span>
        <p className="bonus-spiega">
          A dicembre il datore si riprende il tratt. integrativo già dato: finora
          {' '}<strong>{euroCella(rischio.daRestituire)}</strong>{rischio.rateizzabile ? ', a rate' : ''}.
          In compenso paghi meno IRPEF, e non ci perdi niente. {perche}
        </p>
        <Sospendi settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    ) : (
      <p className="ti-stato ti-stato--ok">✓ Oltre la soglia, niente da restituire.</p>
    );
  } else if (posizione === POSIZIONE.DENTRO) {
    stato = (
      <div className="bonus-rischio">
        <span className="bonus-rischio-titolo">⚠️ Appena sopra la soglia</span>
        <p className="bonus-spiega">
          {rischio.daRestituire > 0 && <>A dicembre torna indietro il tratt. integrativo già dato
            (finora <strong>{euroCella(rischio.daRestituire)}</strong>). </>}
          Meno IRPEF non basta a compensare: ci perdi {euroCella(costo.perditaMax)}. Con
          altri <strong>{euroCella(mancaPareggio)}</strong>{mancaOre !== null && ` (~${mancaOre} h)`} lordi
          torni in pari. {perche}
        </p>
        {rischio.daRestituire > 0 && <Sospendi settings={settings} onUpdateSettings={onUpdateSettings} />}
      </div>
    );
  } else if (bonus.status === BONUS_STATUS.PIENO && bonus.nearThreshold) {
    stato = (
      <div className="bonus-rischio bonus-rischio--anteprima">
        <span className="bonus-rischio-titolo">⚠️ Sei vicino alla soglia</span>
        <p className="bonus-spiega">
          Altri <strong>{euroCella(bonus.marginToFull)}</strong>{bonus.oreResidue !== null && ` (~${bonus.oreResidue} h)`} lordi
          {' '}in tutto l'anno, oltre al previsto, e la superi: a dicembre tornerebbe indietro il
          tratt. integrativo già dato, finora <strong>{euroCella(tiFinora)}</strong>. {perche}
        </p>
        <Sospendi settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    );
  } else if (bonus.status === BONUS_STATUS.PIENO) {
    stato = <p className="ti-stato ti-stato--ok">✓ Di questo passo resti sotto la soglia.</p>;
  } else {
    stato = <p className="ti-stato">Oltre i 28.000 € di reddito il tratt. integrativo non spetta.</p>;
  }

  // 3) LA BARRA, con la sua legenda. In LORDO, come le cifre accanto: la soglia
  // è di reddito, ma la barra la mostra nel lordo che corrisponde (`tetto`).
  const scala = Math.max(tetto * 1.15, bonus.income, annualGross);
  const pct = (v) => `${Math.min(100, Math.max(0, (v / scala) * 100))}%`;
  const tono = posizione === POSIZIONE.OLTRE ? 'oltre'
    : (posizione === POSIZIONE.DENTRO || bonus.nearThreshold) ? 'vicino' : 'sotto';

  return (
    <div className="bonus-strip">
      <div className="bonus-strip-head">
        <span className="bonus-strip-title">💶 Trattamento integrativo (ex bonus Renzi)</span>
      </div>

      {stato}

      {/* 2) COS'È LA SOGLIA: prima il lordo, da confrontare con la busta, poi i
          15.000 che si trovano su ogni guida, perché non sembri un'altra soglia. */}
      {tetto > 0 && rischio.causa !== CAUSA.RINUNCIATO && (
        <p className="ti-soglia">
          La tua soglia lorda è <strong>~{euroCella(tetto)}</strong> l'anno
          {' '}<span className="soglia-lorda">(15.000 € di reddito, cioè lordo meno contributi)</span>.
        </p>
      )}

      {tetto > 0 && (
        <div className={`ti-barra ti-barra--${tono}`} role="img"
          aria-label={`Guadagnato finora ${euroCella(annualGross)}, previsto a dicembre ${euroCella(bonus.income)}, soglia ${euroCella(tetto)} lordi`}>
          <div className="ti-barra-binario">
            <span className="ti-barra-previsto" style={{ width: pct(Math.max(bonus.income, annualGross)) }} />
            <span className="ti-barra-maturato" style={{ width: pct(annualGross) }} />
            <span className="ti-barra-soglia" style={{ left: pct(tetto) }} />
          </div>
          <div className="ti-legenda">
            <span><i className="ti-segno" />finora {euroCella(annualGross)}</span>
            <span><i className="ti-segno ti-segno--previsto" />a dicembre {euroCella(bonus.income)}</span>
            <span><i className="ti-segno ti-segno--soglia" />soglia {euroCella(tetto)}</span>
          </div>
        </div>
      )}
      {/* Il margine si dice sotto la barra, e si dice SU COSA: è sull'anno
          intero, oltre al previsto. Scritto «Margine prima della soglia:
          1.005 €» sembrava il prossimo stipendio. */}
      {posizione === POSIZIONE.SOTTO && bonus.status === BONUS_STATUS.PIENO && !bonus.nearThreshold
        && bonus.marginToFull > 0 && (
        <p className="bonus-strip-note">
          Puoi guadagnare ancora <strong>{euroCella(bonus.marginToFull)}</strong>
          {bonus.oreResidue !== null && ` (~${bonus.oreResidue} h)`} lordi oltre al previsto,
          in tutto l'anno, prima di arrivarci.
        </p>
      )}
      {avvisoMontante}

      {/* 4) DICEMBRE, in una riga: la forchetta e il «perché?» che apre i conti. */}
      {conguaglio && (
        <div className="conguaglio">
          <div className="conguaglio-testa">
            <span>Conguaglio di dicembre</span>
            <strong>{forchettaScritta}</strong>
          </div>
          <span className="bonus-strip-note">
            Stima{conguaglio.direzione === 'debito' ? ': presi in più in busta, non persi' : ''}.{' '}
            <button type="button" className="linklike" onClick={onApriConguaglio}>perché?</button>
          </span>
        </div>
      )}

      {/* 5) LA SIMULAZIONE del premio: affianca, non sostituisce. «I 120 €» e
          non «il bonus»: qui «bonus» si confonderebbe col tratt. integrativo. */}
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
    </div>
  );
}
