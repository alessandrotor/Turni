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
// Qui non si calcola niente: le cifre arrivano da `nettoDelMese`.

import { formatCurrency } from '../utils/pay';

function Mobile({ nome, cifra, attivo, simulato, onTocca, titolo, nelLordo = false }) {
  return (
    <button
      type="button"
      className={`net-pillola net-pillola--piu net-pillola--mobile${attivo ? '' : ' net-pillola--spenta'}`}
      aria-pressed={attivo}
      title={titolo}
      onClick={onTocca}
    >
      <span className="net-pillola-nome">{nome}</span>
      <span className="net-pillola-cifra">{nelLordo ? '' : '+'}{formatCurrency(cifra)}</span>
      {simulato && <span className="net-pillola-sim">simulato</span>}
      {nelLordo && <span className="net-pillola-sim">nel lordo</span>}
    </button>
  );
}

export default function NetPillole({
  lordo, net, effectiveRatePct, tfr,
  bonusImporto, bonusPreso, onBonus,
  tiAttivo, tiSimulato, tiCifra, onTi,
}) {
  return (
    <div className="net-pillole">
      {/* Il premio sta PRIMA del lordo, perché ne fa parte: dopo le trattenute,
          con un «+», si leggeva come un'aggiunta al netto, contato due volte. */}
      {bonusImporto > 0 && (
        <Mobile nome="Bonus" cifra={bonusImporto} attivo={bonusPreso} onTocca={onBonus} nelLordo
          titolo={bonusPreso ? 'Tocca se questo mese non lo prendi' : 'Tocca se questo mese lo prendi'} />
      )}
      <span className="net-pillola">
        <span className="net-pillola-nome">Lordo</span>
        <span className="net-pillola-cifra">{formatCurrency(lordo)}</span>
      </span>
      <span className="net-pillola" title={`${effectiveRatePct.toFixed(1)}% del lordo`}>
        <span className="net-pillola-nome">Trattenute</span>
        <span className="net-pillola-cifra">−{formatCurrency(net.trattenute)}</span>
      </span>
      {tiCifra > 0 && (
        <Mobile nome="Tratt. integrativo" cifra={tiCifra} attivo={tiAttivo} simulato={tiSimulato} onTocca={onTi}
          titolo={tiSimulato ? 'Simulazione: tocca per tornare al calcolo' : 'Tocca per simulare il contrario'} />
      )}
      {net.bonusCuneo > 0 && (
        <span className="net-pillola net-pillola--piu">
          <span className="net-pillola-nome">Indennità L. 207/24</span>
          <span className="net-pillola-cifra">+{formatCurrency(net.bonusCuneo)}</span>
        </span>
      )}
      {tfr > 0 && (
        <span className="net-pillola net-pillola--piu">
          <span className="net-pillola-nome">TFR</span>
          <span className="net-pillola-cifra">+{formatCurrency(tfr)}</span>
        </span>
      )}
    </div>
  );
}
