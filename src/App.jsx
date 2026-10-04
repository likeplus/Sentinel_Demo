import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SensorTelemetry from './pages/SensorTelemetry';
import RiskAssessment from './pages/RiskAssessment';
import Prescription from './pages/Prescription';
import Execution from './pages/Execution';
import AuditReport from './pages/AuditReport';
import History from './pages/History';
import ScenarioControl from './pages/ScenarioControl';
import Admin from './pages/Admin';
import { lazy, Suspense } from 'react';

const GameApp = lazy(() => import('./game/GameApp.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="game" element={<Suspense fallback={<div style={{ padding: 32 }}>正在打开农场试玩…</div>}><GameApp /></Suspense>} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sensors" element={<SensorTelemetry />} />
          <Route path="risk" element={<RiskAssessment />} />
          <Route path="prescription" element={<Prescription />} />
          <Route path="execution" element={<Execution />} />
          <Route path="audit" element={<AuditReport />} />
          <Route path="history" element={<History />} />
          <Route path="scenarios" element={<ScenarioControl />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
