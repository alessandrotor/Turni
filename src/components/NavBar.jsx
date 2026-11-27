import { ENABLE_STATS } from '../config/features';
import Icona from './Icona';

export default function NavBar({ view, onNavigate }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {/* Il marchio della vetrina /benvenuto: quadratino blu, «Segna» scuro e «turni» blu. */}
        <span className="navbar-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="4" fill="none" stroke="#fff" strokeWidth="2" /><path d="M8 3v4M16 3v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" /><path d="M8 13.5l2.7 2.7L16 11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="navbar-title">Segna<b>turni</b></span>
      </div>
      <div className="navbar-links">
        <button
          className={`nav-link ${view === 'calendar' ? 'active' : ''}`}
          onClick={() => onNavigate('calendar')}
        >
          <span className="nav-icon"><Icona nome="calendario" /></span>
          <span className="nav-label">Calendario</span>
        </button>
        {/* Statistiche: pagina ancora da decidere, spenta di default.
            Si toglie la VOCE, non solo la schermata: un pulsante che porta a
            qualcosa che non c'è è peggio dell'assenza del pulsante. */}
        {ENABLE_STATS && (
          <button
            className={`nav-link ${view === 'stats' ? 'active' : ''}`}
            onClick={() => onNavigate('stats')}
          >
            <span className="nav-icon"><Icona nome="statistiche" /></span>
            <span className="nav-label">Statistiche</span>
          </button>
        )}
        <button
          className={`nav-link ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="nav-icon"><Icona nome="impostazioni" /></span>
          <span className="nav-label">Impostazioni</span>
        </button>
      </div>
    </nav>
  );
}
