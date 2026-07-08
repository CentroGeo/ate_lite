import React, { useState } from 'react';
import Navigation from './components/Navigation';
import DashboardPage from './features/dashboard/DashboardPage';
import MapPage from './features/map/MapPage';

export default function App() {
  const [activePage, setActivePage] = useState('map');

  return (
    <>
      <Navigation activePage={activePage} onNavigate={setActivePage} />

      {activePage === 'map' && <MapPage />}
      {activePage === 'dashboard' && <DashboardPage />}
    </>
  );
}
