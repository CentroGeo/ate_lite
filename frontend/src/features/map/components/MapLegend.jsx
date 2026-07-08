import React from 'react';
import { typeIcons, getPinColor, getReadableType } from '../utils/mapConfig';


function SectionHeader({ title, onToggleAll, allHidden }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1.5px solid #006847', paddingBottom: '6px', marginBottom: '10px',
    }}>
      <h4 style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#006847', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {title}
      </h4>
      <button onClick={onToggleAll} style={{
        fontSize: '10px', fontWeight: '600', color: '#006847', background: 'none',
        border: '1px solid #006847', borderRadius: '4px', padding: '2px 7px',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {allHidden ? 'Encender todo' : 'Apagar todo'}
      </button>
    </div>
  );
}


function GenRow({ type, icon, isHidden, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px',
        color: '#393c3e', fontWeight: '500', cursor: 'pointer',
        opacity: isHidden ? 0.5 : 1, transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <input type="checkbox" checked={!isHidden} readOnly style={{ cursor: 'pointer', margin: 0 }} />
      <span style={{
        width: '22px', height: '22px', borderRadius: '50%',
        background: getPinColor(type), border: '2px solid white',
        boxShadow: '0 1px 4px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        filter: isHidden ? 'grayscale(100%)' : 'none',
      }}>
        <img src={icon} alt={type} style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'contain' }} />
      </span>
      {getReadableType(type)}
    </div>
  );
}


export default function MapLegend({
  hiddenTypes, toggleType, toggleAllGen
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const allGenHidden   = Object.keys(typeIcons).every(t => hiddenTypes.has(t));

  return (
    <div style={{
      position: 'absolute', bottom: '24px', left: '16px', zIndex: 10,
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid #dddddd', borderRadius: '10px',
      padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      fontFamily: "'Outfit', sans-serif",
      width: '340px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
      transition: 'all 0.3s ease-in-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? '0' : '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Leyenda
        </h3>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px', borderRadius: '4px', transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          title={isCollapsed ? "Expandir leyenda" : "Contraer leyenda"}
        >
          {isCollapsed ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          )}
        </button>
      </div>

      <div style={{
        display: isCollapsed ? 'none' : 'block',
        animation: isCollapsed ? 'none' : 'fadeIn 0.3s ease-in'
      }}>
        {}
        <SectionHeader
          title="Simbología de Generación"
          onToggleAll={toggleAllGen}
          allHidden={allGenHidden}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: '16px' }}>
          {Object.entries(typeIcons).map(([type, icon]) => (
            <GenRow
              key={type}
              type={type}
              icon={icon}
              isHidden={hiddenTypes.has(type)}
              onToggle={() => toggleType(type)}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
