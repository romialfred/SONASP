import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { DashboardPage } from './pages/DashboardPage';
import { GoldPricesPage } from './pages/prices/GoldPricesPage';
import { FxRatesPage } from './pages/prices/FxRatesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { UsersPage } from './pages/users/UsersPage';
import { ManagementDashboard } from './pages/dashboards/ManagementDashboard';
import { FactoryDashboard } from './pages/dashboards/FactoryDashboard';
import { AirportDashboard } from './pages/dashboards/AirportDashboard';
import { RefineryDashboard } from './pages/dashboards/RefineryDashboard';
import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';
import { BatchListing } from './pages/batches/BatchListing';
import { BatchCreate } from './pages/batches/BatchCreate';
import { BatchDetails } from './pages/batches/BatchDetails';
import { BatchDetailsEnhanced } from './pages/batches/BatchDetailsEnhanced';
import { BatchDetailsWorkflow } from './pages/batches/BatchDetailsWorkflow';
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
import { UserPermissionsPage } from './pages/admin/UserPermissionsPage';
import { SystemSettings } from './pages/admin/SystemSettings';
import { AuditTrail } from './pages/admin/AuditTrail';
import { ApprovalsDashboard } from './pages/admin/ApprovalsDashboard';
import { TransportCompaniesPage } from './pages/admin/TransportCompaniesPage';
import { RefineriesPage } from './pages/admin/RefineriesPage';
import { ShippingPage } from './pages/shipping/ShippingPage';
import { PERMISSIONS } from './lib/permissions';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* New main pages with demo data */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gold-prices"
              element={
                <ProtectedRoute>
                  <GoldPricesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fx-rates"
              element={
                <ProtectedRoute>
                  <FxRatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditTrailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              }
            />

            {/* Legacy dashboard routes */}
            <Route
              path="/dashboard/management"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ManagementDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/factory"
              element={
                <ProtectedRoute allowedRoles={['factory']}>
                  <FactoryDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/airport"
              element={
                <ProtectedRoute allowedRoles={['airport']}>
                  <AirportDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/refinery"
              element={
                <ProtectedRoute allowedRoles={['refinery']}>
                  <RefineryDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/customer"
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/batches"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <BatchListing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches/new"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_CREATE}>
                  <BatchCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <BatchDetailsWorkflow />
                </ProtectedRoute>
              }
            />

            <Route
              path="/shipping"
              element={
                <ProtectedRoute>
                  <ShippingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/receiving"
              element={
                <ProtectedRoute allowedRoles={['airport', 'refinery']}>
                  <ReceivingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receiving/:id/confirm"
              element={
                <ProtectedRoute allowedRoles={['airport', 'refinery']}>
                  <ReceivingConfirm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/refining"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <RefiningDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/refining/:id/process"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <RefiningProcess />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_VIEW}>
                  <SalesDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/new"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_CREATE}>
                  <SaleCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_VIEW}>
                  <SaleDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_VIEW}>
                  <CustomerListing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_VIEW}>
                  <CustomerProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id/payments"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_VIEW}>
                  <PaymentProcessing />
                </ProtectedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <AnalyticsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.REPORTS_VIEW}>
                  <ReportGeneration />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/:userId/permissions"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UserPermissionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS_VIEW}>
                  <SystemSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.AUDIT_VIEW}>
                  <AuditTrail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ApprovalsDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/transport-companies"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <TransportCompaniesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/refineries"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <RefineriesPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
