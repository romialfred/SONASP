import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { ManagementDashboard } from './pages/dashboards/ManagementDashboard';
import { FactoryDashboard } from './pages/dashboards/FactoryDashboard';
import { AirportDashboard } from './pages/dashboards/AirportDashboard';
import { RefineryDashboard } from './pages/dashboards/RefineryDashboard';
import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';
import { BatchListing } from './pages/batches/BatchListing';
import { BatchCreate } from './pages/batches/BatchCreate';
import { BatchDetails } from './pages/batches/BatchDetails';
import { ReceivingDashboard } from './pages/receiving/ReceivingDashboard';
import { ReceivingConfirm } from './pages/receiving/ReceivingConfirm';
import { RefiningDashboard } from './pages/refining/RefiningDashboard';
import { RefiningProcess } from './pages/refining/RefiningProcess';

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

          <Route path="/batches" element={<BatchListing />} />
          <Route path="/batches/new" element={<BatchCreate />} />
          <Route path="/batches/:id" element={<BatchDetails />} />

          <Route path="/receiving" element={<ReceivingDashboard />} />
          <Route path="/receiving/:id/confirm" element={<ReceivingConfirm />} />

          <Route path="/refining" element={<RefiningDashboard />} />
          <Route path="/refining/:id/process" element={<RefiningProcess />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
