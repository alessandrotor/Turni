export default function NavBar({ view, onNavigate }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-icon">🕐</span>
        <span className="navbar-title">Turni</span>
      </div>
      <div className="navbar-links">
        <button
          className={`nav-link ${view === 'week' ? 'active' : ''}`}
          onClick={() => onNavigate('week')}
        >
          <span className="nav-icon">📅</span>
          <span>Settimana</span>
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
