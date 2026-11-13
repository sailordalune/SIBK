import { Link } from 'react-router-dom';
import brandMark from '../assets/brand-mark.svg';

export const RESULT_SECTIONS = [
  { id: 'ringkasan', label: 'Ringkasan', icon: 'summary' },
  { id: 'rasio', label: 'Rasio & Tier', icon: 'ratios' },
  { id: 'valuasi', label: 'Valuasi', icon: 'wallet' },
  { id: 'data-ekstraksi', label: 'Data Ekstraksi', icon: 'table' },
];

const ICON_PATHS = {
  add: 'M12 5v14M5 12h14',
  summary: 'M6 3h9l3 3v15H6zM14 3v4h4M9 11h6m-6 4h6',
  ratios: 'M4 4v16h16M8 16v-3m4 3V9m4 7v-5m4 5V7',
  wallet: 'M4 7h16v13H4zM4 7l14-3v3m2 5h-5a2 2 0 0 0 0 4h5',
  table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8m-8 3h5',
};

function NavigationIcon({ name }) {
  return (
    <svg className="workspace-nav-icon" width="19" height="19" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export default function WorkspaceNavigation({ resultRoute, showResultSections, activeSection, chatRoute, chatPageAvailable }) {
  return (
    <header className="workspace-header">
      <div className="workspace-masthead">
        <Link to="/" className="workspace-brand" aria-label="TelusurFin, halaman unggah">
          <span className="workspace-brand-mark"><img src={brandMark} width="27" height="27" alt="" /></span>
          <span>TelusurFin</span>
        </Link>
        <div className="workspace-actions">
          {chatPageAvailable && !showResultSections && !chatRoute && (
            <Link className="workspace-nav-link" to="/chatbot">
              <NavigationIcon name="chat" />
              <span>Asisten AI</span>
            </Link>
          )}
          <Link className="workspace-new" to="/" aria-current={!resultRoute && !chatRoute ? 'page' : undefined}>
            <NavigationIcon name="add" />
            Analisis baru
          </Link>
        </div>
      </div>

      {showResultSections && (
        <nav className="workspace-nav" aria-label="Navigasi TelusurFin">
          <ul className="workspace-nav-list">
            {RESULT_SECTIONS.map(({ id, label, icon }) => (
              <li key={id}>
                <Link className="workspace-nav-link"
                  to={{ pathname: '/result', hash: '#' + id }}
                  aria-current={activeSection === id ? 'page' : undefined}>
                  <NavigationIcon name={icon} />
                  <span>{label}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link className="workspace-nav-link" to="/chatbot">
                <NavigationIcon name="chat" />
                <span>Asisten AI</span>
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
