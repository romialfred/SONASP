import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { DialogProvider } from './contexts/DialogContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProfileGuard } from './components/auth/ProfileGuard';
import { PublicRoute } from './components/auth/PublicRoute';
import { DomainRestriction } from './components/auth/DomainRestriction';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import ActivateAccount from './pages/auth/ActivateAccount';
import { DashboardPage } from './pages/DashboardPage';
import { GoldPricesPage } from './pages/prices/GoldPricesPage';
import { FxRatesPage } from './pages/prices/FxRatesPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { ManagementDashboard } from './pages/dashboards/ManagementDashboard';
import { FactoryDashboard } from './pages/dashboards/FactoryDashboard';
import { AirportDashboard } from './pages/dashboards/AirportDashboard';
import { RefineryDashboard } from './pages/dashboards/RefineryDashboard';
import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';
import { BatchListing } from './pages/batches/BatchListing';
import { BatchCreate } from './pages/batches/BatchCreate';
import { BatchDetailsWorkflow } from './pages/batches/BatchDetailsWorkflow';
import { AssayCertificatesPage } from './pages/documents/AssayCertificatesPage';
import { ReceivingDashboard } from './pages/receiving/ReceivingDashboard';
import { ReceivingConfirm } from './pages/receiving/ReceivingConfirm';
import { RefiningDashboard } from './pages/refining/RefiningDashboard';
import { RefiningProcess } from './pages/refining/RefiningProcess';
import { RefineryReceivingConfirm } from './pages/refining/RefineryReceivingConfirm';
import { SalesDashboard } from './pages/sales/SalesDashboard';
import { SaleCreate } from './pages/sales/SaleCreate';
import { SaleDetails } from './pages/sales/SaleDetails';
import { GoldTradeSpace } from './pages/sales/GoldTradeSpace';
import { CustomerSaleApproval } from './pages/sales/CustomerSaleApproval';
import PreSalesDashboard from './pages/presales/PreSalesDashboard';
import PreSaleCreate from './pages/presales/PreSaleCreate';
import PreSaleDetails from './pages/presales/PreSaleDetails';
import HelpCenter from './pages/HelpCenter';
import { CustomerListing } from './pages/customers/CustomerListing';
import { CustomerProfile } from './pages/customers/CustomerProfile';
import { CustomerForm } from './pages/customers/CustomerForm';
import { PaymentProcessing } from './pages/customers/PaymentProcessing';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { PaymentCreate } from './pages/payments/PaymentCreate';
import { PaymentDetailsPage } from './pages/payments/PaymentDetailsPage';
import { PaymentRecordPage } from './pages/payments/PaymentRecordPage';
import { VirtualPaymentsPage } from './pages/payments/VirtualPaymentsPage';
import { AnalyticsDashboardEnhanced as AnalyticsDashboard } from './pages/analytics/AnalyticsDashboardEnhanced';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { UserPermissionsPage } from './pages/admin/UserPermissionsPage';
import { SystemSettings } from './pages/admin/SystemSettings';
import { ApprovalsDashboard } from './pages/admin/ApprovalsDashboard';
import { TransportCompaniesPage } from './pages/admin/TransportCompaniesPage';
import { TransportCompanyForm } from './pages/admin/TransportCompanyForm';
import { RefineryForm } from './pages/admin/RefineryForm';
import { RefineriesPage } from './pages/admin/RefineriesPage';
import { ParametersPage } from './pages/admin/ParametersPage';
import GoldShippingWorkflow from './pages/admin/GoldShippingWorkflow';
import { BatchApprovalFactory } from './pages/batches/BatchApprovalFactory';
import { InventoryManagement } from './pages/inventory/InventoryManagement';
import { AddInventoryEntry } from './pages/inventory/AddInventoryEntry';
import { SilverInventoryManagement } from './pages/inventory/SilverInventoryManagement';
import { MiningCompaniesPage } from './pages/stakeholders/MiningCompaniesPage';
import { MiningCompanyForm } from './pages/stakeholders/MiningCompanyForm';
import { MiningCompanyDetails } from './pages/stakeholders/MiningCompanyDetails';
import { FreightCompaniesPage } from './pages/stakeholders/FreightCompaniesPage';
import { RefineryPlantsPage } from './pages/stakeholders/RefineryPlantsPage';
import { DailyProductionPage } from './pages/production/DailyProductionPage';
import { ProductionDetails } from './pages/production/ProductionDetails';
import { ProductionInSafe } from './pages/production/ProductionInSafe';
import { BudgetManagementPage } from './pages/production/BudgetManagementPage';
import { ExportLicensesPage } from './pages/production/ExportLicensesPage';
import { ExportLicenseForm } from './pages/production/ExportLicenseForm';
import { ExportLicenseDetails } from './pages/production/ExportLicenseDetails';
import { ForecastManagementPage } from './pages/performance/ForecastManagementPage';
import ShippingDashboard from './pages/shipping/ShippingDashboard';
import ShippingPreparationNew from './pages/shipping/ShippingPreparationNew';
import ShippingPreparationDetailsEnhanced from './pages/shipping/ShippingPreparationDetailsEnhanced';
import ShippingPreparationEdit from './pages/shipping/ShippingPreparationEdit';
import FreightCustomsDashboard from './pages/freight/FreightCustomsDashboard';
import FreightCustomsDetails from './pages/freight/FreightCustomsDetails';
import FreightCustomsCreate from './pages/freight/FreightCustomsCreate';
import { PERMISSIONS } from './lib/permissions';
import { AppErrorBoundary, RouteErrorBoundary } from './components/common/ErrorBoundary';
import { RouteFallback } from './components/common/RouteFallback';

function AppRoutes() {
  const location = useLocation();

  return (
    <RouteErrorBoundary key={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
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
            <Route
              path="/activate-account"
              element={
                <PublicRoute>
                  <ActivateAccount />
                </PublicRoute>
              }
            />

            {/* Main dashboard */}
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

            {/* Help Center - Accessible to all authenticated users */}
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <HelpCenter />
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
              path="/shipping/preparation"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <ShippingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/new"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <ShippingPreparationNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/edit/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <ShippingPreparationNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <ShippingPreparationDetailsEnhanced />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/:id/details"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <ShippingPreparationDetailsEnhanced />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/:id/edit"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <ShippingPreparationEdit />
                </ProtectedRoute>
              }
            />

            {/* Freight & Customs Routes */}
            <Route
              path="/freight-customs"
              element={
                <ProtectedRoute>
                  <FreightCustomsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/freight-customs/create"
              element={
                <ProtectedRoute>
                  <FreightCustomsCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/freight-customs/:id"
              element={
                <ProtectedRoute>
                  <FreightCustomsDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/documents/assay-certificates"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.BATCHES_VIEW}>
                  <AssayCertificatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches/approvals"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <BatchApprovalFactory />
                </ProtectedRoute>
              }
            />

            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <InventoryManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/add"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <AddInventoryEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/silver"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <SilverInventoryManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/receiving"
              element={
                <ProtectedRoute allowedRoles={['airport', 'refinery', 'management']}>
                  <ReceivingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receiving/:id/confirm"
              element={
                <ProtectedRoute allowedRoles={['airport', 'refinery', 'management']}>
                  <ReceivingConfirm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <ProfileGuard>
                    <ReceivingDashboard />
                  </ProfileGuard>
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
              path="/refining/:id/receive"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <RefineryReceivingConfirm />
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

            {/* Pre-Sales Routes */}
            <Route
              path="/presales"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_VIEW}>
                  <PreSalesDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/presales/new"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_CREATE}>
                  <PreSaleCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/presales/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_VIEW}>
                  <PreSaleDetails />
                </ProtectedRoute>
              }
            />

            {/* Sales Routes */}
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
              path="/sales/trade-space"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SALES_CREATE}>
                  <GoldTradeSpace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/approve/:saleId/:token"
              element={
                <CustomerSaleApproval />
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
                  <ProfileGuard>
                    <CustomerListing />
                  </ProfileGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/new"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_CREATE}>
                  <ProfileGuard>
                    <CustomerForm />
                  </ProfileGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id/edit"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_EDIT}>
                  <ProfileGuard>
                    <CustomerForm />
                  </ProfileGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_VIEW}>
                  <ProfileGuard>
                    <CustomerProfile />
                  </ProfileGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id/payments"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.CUSTOMERS_VIEW}>
                  <ProfileGuard>
                    <PaymentProcessing />
                  </ProfileGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/create"
              element={
                <ProtectedRoute>
                  <PaymentCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/virtual"
              element={
                <ProtectedRoute>
                  <VirtualPaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/record"
              element={
                <ProtectedRoute>
                  <PaymentRecordPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/:id"
              element={
                <ProtectedRoute>
                  <PaymentDetailsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.REPORTS_VIEW}>
                  <ReportsDashboard />
                </ProtectedRoute>
              }
            />

            {/* Production Routes */}
            <Route
              path="/production/daily"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <DailyProductionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production/:id"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <ProductionDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production/in-safe"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <ProductionInSafe />
                </ProtectedRoute>
              }
            />

            {/* Export Licenses Routes */}
            <Route
              path="/production/licenses"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ExportLicensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production/licenses/new"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ExportLicenseForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production/licenses/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ExportLicenseForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production/licenses/:id"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ExportLicenseDetails />
                </ProtectedRoute>
              }
            />

            {/* Performance Management Routes */}
            <Route
              path="/performance/forecasts"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ForecastManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/performance/budgets"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <BudgetManagementPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/stakeholders/mining-companies"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <MiningCompaniesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stakeholders/mining-companies/new"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <MiningCompanyForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stakeholders/mining-companies/:id"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <MiningCompanyDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stakeholders/mining-companies/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <MiningCompanyForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/stakeholders/freight-companies"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <FreightCompaniesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/stakeholders/refinery-plants"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <RefineryPlantsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UserManagement />
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
              path="/parameters"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS_VIEW}>
                  <ParametersPage />
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
                  <AuditTrailPage />
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
              path="/admin/transport-companies/new"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <TransportCompanyForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/transport-companies/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <TransportCompanyForm />
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

            <Route
              path="/admin/refineries/new"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <RefineryForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/refineries/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <RefineryForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/workflow"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <GoldShippingWorkflow />
                </ProtectedRoute>
              }
            />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <DomainRestriction>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <DialogProvider>
                <AppErrorBoundary>
                  <AppRoutes />
                </AppErrorBoundary>
              </DialogProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </DomainRestriction>
  );
}

export default App;
