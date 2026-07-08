import React, { useState } from 'react';

const RANGES = [
  { label: 'Todos', min: 0, max: 99999 },
  { label: '0 - 10 MW', min: 0, max: 10 },
  { label: '10 - 50 MW', min: 10, max: 50 },
  { label: '50 - 100 MW', min: 50, max: 100 },
  { label: '100 - 500 MW', min: 100, max: 500 },
  { label: '500 - 1000 MW', min: 500, max: 1000 },
  { label: 'Más de 1000 MW', min: 1000, max: 99999 },
];

export default function MapFilter({ capacityRange, setCapacityRange }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const applyFilter = () => {
    setCapacityRange({
      min: RANGES[selectedIndex].min,
      max: RANGES[selectedIndex].max
    });
  };

  return (
    <div style={{
      position: 'absolute', top: '24px', left: '24px', zIndex: 10,
      background: 'rgba(255,255,255,0.98)',
      border: '1px solid #e2e8f0', borderRadius: '8px',
      padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '8px'
    }}>
      <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginLeft: '4px' }}>
        Capacidad:
      </label>
      
      <select 
        value={selectedIndex}
        onChange={(e) => setSelectedIndex(Number(e.target.value))}
        style={{
          padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
          fontFamily: 'inherit', fontSize: '13px', color: '#334155', cursor: 'pointer',
          background: 'white', outline: 'none'
        }}
      >
        {RANGES.map((r, i) => (
          <option key={i} value={i}>{r.label}</option>
        ))}
      </select>

      <button
        onClick={applyFilter}
        style={{
          background: '#006847', color: 'white',
          border: 'none', borderRadius: '6px',
          padding: '8px 16px', fontWeight: 'bold', fontSize: '13px',
          cursor: 'pointer', transition: 'background 0.2s', fontFamily: 'inherit'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = '#004f36'}
        onMouseOut={(e) => e.currentTarget.style.background = '#006847'}
      >
        Filtrar
      </button>
    </div>
  );
}

