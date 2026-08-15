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
        <button
          className={`nav-link ${view === 'stats' ? 'active' : ''}`}
          onClick={() => onNavigate('stats')}
        >
          <span className="nav-icon">📊</span>
          <span>Statistiche</span>
        </button>
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
