import { lazy, Suspense } from 'react';
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
import { AuthCallback } from './pages/auth/AuthCallback';
import { GoldPricesPage } from './pages/prices/GoldPricesPage';
import { FxRatesPage } from './pages/prices/FxRatesPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { ManagementDashboard } from './pages/dashboards/ManagementDashboard';
import { FactoryDashboard } from './pages/dashboards/FactoryDashboard';
import { AirportDashboard } from './pages/dashboards/AirportDashboard';
import { RefineryDashboard } from './pages/dashboards/RefineryDashboard';
import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';
import { ProductionDashboardModern } from './pages/dashboards/ProductionDashboardModern';
import { GlobalDashboardEnhanced } from './pages/dashboards/GlobalDashboardEnhanced';
import { AssayCertificatesModern } from './pages/documents/AssayCertificatesModern';
import { RefiningProcess } from './pages/refining/RefiningProcess';
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
import { AnalyticsIntelligenceCenter } from './pages/analytics/AnalyticsIntelligenceCenter';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { UsersListPage } from './pages/admin/UsersListPage';
import { UserManagementModern } from './pages/admin/UserManagementModern';
import { UserPermissionsPage } from './pages/admin/UserPermissionsPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';
import { ApprovalsDashboard } from './pages/admin/ApprovalsDashboard';
import { TransportCompaniesPage } from './pages/admin/TransportCompaniesPage';
import { TransportCompanyForm } from './pages/admin/TransportCompanyForm';
import { RefineryForm } from './pages/admin/RefineryForm';
import { RefineriesPage } from './pages/admin/RefineriesPage';
import { ParametersPage } from './pages/admin/ParametersPage';
import GoldShippingWorkflow from './pages/admin/GoldShippingWorkflow';
import GoldSalesSettingsPage from './pages/admin/GoldSalesSettingsPage';
import StatusManagerPage from './pages/admin/StatusManagerPage';
import ModulesManagement from './pages/admin/ModulesManagement';
import { InventoryManagement } from './pages/inventory/InventoryManagement';
import { AddInventoryEntry } from './pages/inventory/AddInventoryEntry';
import { SilverInventoryManagement } from './pages/inventory/SilverInventoryManagement';
import { MiningCompaniesPage } from './pages/stakeholders/MiningCompaniesPage';
import { MiningCompanyForm } from './pages/stakeholders/MiningCompanyForm';
import { MiningCompanyDetails } from './pages/stakeholders/MiningCompanyDetails';
import { FreightCompaniesPage } from './pages/stakeholders/FreightCompaniesPage';
import { RefineryPlantsPage } from './pages/stakeholders/RefineryPlantsPage';
import { DepositorsPage } from './pages/stakeholders/DepositorsPage';
import { DepositorFormPage } from './pages/stakeholders/DepositorFormPage';
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
import FreightShipmentDashboard from './pages/freight/FreightShipmentDashboard';
import FreightShipmentCreate from './pages/freight/FreightShipmentCreate';
import FreightShipmentDetails from './pages/freight/FreightShipmentDetails';
import FreightShipmentsRefining from './pages/refining/FreightShipmentsRefining';
import ArtisanMinierDashboard from './pages/artisan-minier/ArtisanMinierDashboard';
import ArtisanMinierListe from './pages/artisan-minier/ArtisanMinierListe';
import ArtisanMinierDetails from './pages/artisan-minier/ArtisanMinierDetails';
import ArtisanMinierEdit from './pages/artisan-minier/ArtisanMinierEdit';
import CarteSuivi from './pages/artisan-minier/CarteSuivi';
import CarteValidation from './pages/artisan-minier/CarteValidation';
import CarteExpirations from './pages/artisan-minier/CarteExpirations';
import VentesOr from './pages/artisan-minier/VentesOr';
import VenteOrForm from './pages/artisan-minier/VenteOrForm';
import VenteOrDetails from './pages/artisan-minier/VenteOrDetails';
import InfractionForm from './pages/artisan-minier/InfractionForm';
import InfractionDetails from './pages/artisan-minier/InfractionDetails';
import PaiementsVentesDashboard from './pages/artisan-minier/PaiementsVentesDashboard';
import PaiementForm from './pages/artisan-minier/PaiementForm';
import PaiementsHistorique from './pages/artisan-minier/PaiementsHistorique';
import CentreRapportsAnalyse from './pages/artisan-minier/CentreRapportsAnalyse';
import RapportChiffreAffaires from './pages/artisan-minier/RapportChiffreAffaires';
import RapportQuantites from './pages/artisan-minier/RapportQuantites';
import RapportTaxesRoyalties from './pages/artisan-minier/RapportTaxesRoyalties';
import ArtisanalSiteProduction from './pages/artisanal-sites/ArtisanalSiteProduction';
import { PERMISSIONS } from './lib/permissions';
import { AppErrorBoundary, RouteErrorBoundary } from './components/common/ErrorBoundary';
import { RouteFallback } from './components/common/RouteFallback';

const ArtisanalSitesOverview = lazy(() => import('./pages/artisanal-sites/ArtisanalSitesOverview'));
const ArtisanalSiteForm = lazy(() => import('./pages/artisanal-sites/ArtisanalSiteForm'));

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
            <Route
              path="/auth/callback"
              element={<AuthCallback />}
            />

            {/* Main dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <GlobalDashboardEnhanced />
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
            {/* Modern dashboards */}
            <Route
              path="/dashboard/production-modern"
              element={
                <ProtectedRoute>
                  <ProductionDashboardModern />
                </ProtectedRoute>
              }
            />

            {/* Role-specific dashboards */}
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

            {/* Artisan Minier Routes */}
            <Route
              path="/artisan-minier"
              element={
                <ProtectedRoute>
                  <ArtisanMinierDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/liste"
              element={
                <ProtectedRoute>
                  <ArtisanMinierListe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/cartes/suivi"
              element={
                <ProtectedRoute>
                  <CarteSuivi />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/:id"
              element={
                <ProtectedRoute>
                  <ArtisanMinierDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/:id/edit"
              element={
                <ProtectedRoute>
                  <ArtisanMinierEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/cartes/validation"
              element={
                <ProtectedRoute>
                  <CarteValidation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/cartes/expirations"
              element={
                <ProtectedRoute>
                  <CarteExpirations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/ventes-or"
              element={
                <ProtectedRoute>
                  <VentesOr />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/ventes-or/nouvelle"
              element={
                <ProtectedRoute>
                  <VenteOrForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/ventes-or/:id"
              element={
                <ProtectedRoute>
                  <VenteOrDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/ventes-or/:id/modifier"
              element={
                <ProtectedRoute>
                  <VenteOrForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/paiements"
              element={
                <ProtectedRoute>
                  <PaiementsVentesDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/paiements/:venteId/nouveau"
              element={
                <ProtectedRoute>
                  <PaiementForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/paiements/historique"
              element={
                <ProtectedRoute>
                  <PaiementsHistorique />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/:artisanId/infractions/nouvelle"
              element={
                <ProtectedRoute>
                  <InfractionForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/:artisanId/infractions/:infractionId"
              element={
                <ProtectedRoute>
                  <InfractionDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/rapports"
              element={
                <ProtectedRoute>
                  <CentreRapportsAnalyse />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/rapports/chiffre-affaires"
              element={
                <ProtectedRoute>
                  <RapportChiffreAffaires />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/rapports/quantites"
              element={
                <ProtectedRoute>
                  <RapportQuantites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/rapports/taxes"
              element={
                <ProtectedRoute>
                  <RapportTaxesRoyalties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-minier/:artisanId/infractions/:infractionId/modifier"
              element={
                <ProtectedRoute>
                  <InfractionForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/shipping/preparation"
              element={
                <ProtectedRoute>
                  <ShippingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/new"
              element={
                <ProtectedRoute>
                  <ShippingPreparationNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/edit/:id"
              element={
                <ProtectedRoute>
                  <ShippingPreparationNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/:id"
              element={
                <ProtectedRoute>
                  <ShippingPreparationDetailsEnhanced />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/:id/details"
              element={
                <ProtectedRoute>
                  <ShippingPreparationDetailsEnhanced />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipping/preparation/:id/edit"
              element={
                <ProtectedRoute>
                  <ShippingPreparationEdit />
                </ProtectedRoute>
              }
            />

            {/* Invoice & Consignment Routes - NEW SYSTEM */}
            <Route
              path="/freight"
              element={
                <ProtectedRoute>
                  <FreightShipmentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/freight/shipments/create"
              element={
                <ProtectedRoute>
                  <FreightShipmentCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/freight/shipments/:id"
              element={
                <ProtectedRoute>
                  <FreightShipmentDetails />
                </ProtectedRoute>
              }
            />

            {/* Invoice & Consignment Routes - OLD SYSTEM (kept for compatibility) */}
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
                <ProtectedRoute>
                  <AssayCertificatesModern />
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
              path="/shipping"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <ProfileGuard>
                    <ShippingDashboard />
                  </ProfileGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/refining"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <RefiningProcess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/refining/freight-shipments"
              element={
                <ProtectedRoute allowedRoles={['refinery', 'management']}>
                  <FreightShipmentsRefining />
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
                  <AnalyticsIntelligenceCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/legacy"
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

            {/* Artisanal Sites Routes */}
            <Route
              path="/artisan-sites"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ArtisanalSitesOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-sites/nouveau"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ArtisanalSiteForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-sites/:siteId/modifier"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ArtisanalSiteForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artisan-sites/production"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ArtisanalSiteProduction />
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
              path="/stakeholders/depositors"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <DepositorsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/stakeholders/depositors/new"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <DepositorFormPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/stakeholders/depositors/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <DepositorFormPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UsersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/new"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UserManagementModern />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/edit"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UserManagementModern />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:userId"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UserDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}>
                  <UsersListPage />
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
              path="/admin/status-manager"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.SYSTEM_SETTINGS_MANAGE}>
                  <StatusManagerPage />
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
            {/* `/settings` proposait un ecran de configuration qui n'enregistrait rien :
                son bouton « Save Changes » se contentait d'un `console.log`. Le
                parametrage reel vit sur `/parameters`. */}
            <Route path="/settings" element={<Navigate to="/parameters" replace />} />
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

            <Route
              path="/admin/gold-sales-settings"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <GoldSalesSettingsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/modules"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ModulesManagement />
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
