import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { ManagementDashboard } from './pages/dashboards/ManagementDashboard';
import { FactoryDashboard } from './pages/dashboards/FactoryDashboard';
import { AirportDashboard } from './pages/dashboards/AirportDashboard';
import { RefineryDashboard } from './pages/dashboards/RefineryDashboard';
import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ManagementDashboard />} />
          <Route path="/dashboard/factory" element={<FactoryDashboard />} />
          <Route path="/dashboard/airport" element={<AirportDashboard />} />
          <Route path="/dashboard/refinery" element={<RefineryDashboard />} />
          <Route path="/dashboard/customer" element={<CustomerDashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
