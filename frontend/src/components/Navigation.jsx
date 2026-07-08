import React from 'react';

export default function Navigation({ activePage, onNavigate }) {
  return (
    <nav className="navbar">
      <div className="logo-container">
        <div className="logo-icon flex items-center justify-center">
          <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="logo-text">ATE <span>CNE</span></div>
      </div>

      <div className="nav-links">
        <button
          className={`nav-link ${activePage === 'map' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('map')}
        >
          Mapa Nacional
        </button>

        <button
          className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>
      </div>
    </nav>
  );
}
