import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import CloudflarePage from './pages/CloudflarePage';
import SpamExpertsPage from './pages/SpamExpertsPage';
import OPNsensePage from './pages/OPNsensePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="cloudflare" element={<CloudflarePage />} />
        <Route path="spamexperts" element={<SpamExpertsPage />} />
        <Route path="opnsense" element={<OPNsensePage />} />
      </Route>
    </Routes>
  );
}

export default App;
