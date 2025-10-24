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
import { SalesDashboard } from './pages/sales/SalesDashboard';
import { SaleCreate } from './pages/sales/SaleCreate';
import { SaleDetails } from './pages/sales/SaleDetails';
import { CustomerListing } from './pages/customers/CustomerListing';
import { CustomerProfile } from './pages/customers/CustomerProfile';
import { PaymentProcessing } from './pages/customers/PaymentProcessing';
import { AnalyticsDashboard } from './pages/analytics/AnalyticsDashboard';
import { ReportGeneration } from './pages/reports/ReportGeneration';
import { UserManagement } from './pages/admin/UserManagement';
import { SystemSettings } from './pages/admin/SystemSettings';
import { AuditTrail } from './pages/admin/AuditTrail';

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

          <Route path="/sales" element={<SalesDashboard />} />
          <Route path="/sales/new" element={<SaleCreate />} />
          <Route path="/sales/:id" element={<SaleDetails />} />

          <Route path="/customers" element={<CustomerListing />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />
          <Route path="/customers/:id/payments" element={<PaymentProcessing />} />

          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/reports" element={<ReportGeneration />} />

          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/settings" element={<SystemSettings />} />
          <Route path="/audit" element={<AuditTrail />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
