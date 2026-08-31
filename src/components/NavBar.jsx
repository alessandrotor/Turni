import { ENABLE_STATS } from '../config/features';

export default function NavBar({ view, onNavigate }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">🕐</span>
        <span className="navbar-title">Turni</span>
      </div>
      <div className="navbar-links">
        <button
          className={`nav-link ${view === 'calendar' ? 'active' : ''}`}
          onClick={() => onNavigate('calendar')}
        >
          <span className="nav-icon">📅</span>
          <span>Calendario</span>
        </button>
        {/* Statistiche: pagina ancora da decidere, spenta di default.
            Si toglie la VOCE, non solo la schermata: un pulsante che porta a
            qualcosa che non c'è è peggio dell'assenza del pulsante. */}
        {ENABLE_STATS && (
          <button
            className={`nav-link ${view === 'stats' ? 'active' : ''}`}
            onClick={() => onNavigate('stats')}
          >
            <span className="nav-icon">📊</span>
            <span>Statistiche</span>
          </button>
        )}
        <button
          className={`nav-link ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span>Impostazioni</span>
        </button>
      </div>
    </nav>
  );
}
