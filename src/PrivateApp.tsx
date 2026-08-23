import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { DialogProvider } from './contexts/DialogContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MinePortalGuard } from './components/auth/MinePortalGuard';
import { MandatoryMfaGate } from './components/auth/MandatoryMfaGate';
import { ProfileGuard } from './components/auth/ProfileGuard';
import { PublicRoute } from './components/auth/PublicRoute';
import { PERMISSIONS } from './lib/permissions';
import { AppErrorBoundary, RouteErrorBoundary } from './components/common/ErrorBoundary';
import { RouteFallback } from './components/common/RouteFallback';
import { NationalDashboardChrome } from './components/layout/NationalDashboardLayout';

function lazyNamed<TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as unknown as ComponentType };
  });
}

const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const Profile = lazyNamed(() => import('./pages/Profile'), 'Profile');
const ActivateAccount = lazy(() => import('./pages/auth/ActivateAccount'));
const AuthCallback = lazyNamed(() => import('./pages/auth/AuthCallback'), 'AuthCallback');
const GoldPricesPage = lazyNamed(() => import('./pages/prices/GoldPricesPage'), 'GoldPricesPage');
const FxRatesPage = lazyNamed(() => import('./pages/prices/FxRatesPage'), 'FxRatesPage');
const AuditTrailPage = lazyNamed(() => import('./pages/AuditTrailPage'), 'AuditTrailPage');
const ManagementDashboard = lazyNamed(() => import('./pages/dashboards/ManagementDashboard'), 'ManagementDashboard');
const FactoryDashboard = lazyNamed(() => import('./pages/dashboards/FactoryDashboard'), 'FactoryDashboard');
const AirportDashboard = lazyNamed(() => import('./pages/dashboards/AirportDashboard'), 'AirportDashboard');
const RefineryDashboard = lazyNamed(() => import('./pages/dashboards/RefineryDashboard'), 'RefineryDashboard');
const CustomerDashboard = lazyNamed(() => import('./pages/dashboards/CustomerDashboard'), 'CustomerDashboard');
const ProductionDashboardModern = lazyNamed(() => import('./pages/dashboards/ProductionDashboardModern'), 'ProductionDashboardModern');
const GlobalDashboardEnhanced = lazyNamed(() => import('./pages/dashboards/GlobalDashboardEnhanced'), 'GlobalDashboardEnhanced');
const AssayCertificatesModern = lazyNamed(() => import('./pages/documents/AssayCertificatesModern'), 'AssayCertificatesModern');
const RefiningProcess = lazyNamed(() => import('./pages/refining/RefiningProcess'), 'RefiningProcess');
const SalesDashboard = lazyNamed(() => import('./pages/sales/SalesDashboard'), 'SalesDashboard');
const SaleCreate = lazyNamed(() => import('./pages/sales/SaleCreate'), 'SaleCreate');
const SaleDetails = lazyNamed(() => import('./pages/sales/SaleDetails'), 'SaleDetails');
const GoldTradeSpace = lazyNamed(() => import('./pages/sales/GoldTradeSpace'), 'GoldTradeSpace');
const CustomerSaleApproval = lazyNamed(() => import('./pages/sales/CustomerSaleApproval'), 'CustomerSaleApproval');
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const CustomerListing = lazyNamed(() => import('./pages/customers/CustomerListing'), 'CustomerListing');
const CustomerProfile = lazyNamed(() => import('./pages/customers/CustomerProfile'), 'CustomerProfile');
const CustomerForm = lazyNamed(() => import('./pages/customers/CustomerForm'), 'CustomerForm');
const PaymentsPage = lazyNamed(() => import('./pages/payments/PaymentsPage'), 'PaymentsPage');
const PaymentCreate = lazyNamed(() => import('./pages/payments/PaymentCreate'), 'PaymentCreate');
const PaymentDetailsPage = lazyNamed(() => import('./pages/payments/PaymentDetailsPage'), 'PaymentDetailsPage');
const PaymentRecordPage = lazyNamed(() => import('./pages/payments/PaymentRecordPage'), 'PaymentRecordPage');
const VirtualPaymentsPage = lazyNamed(() => import('./pages/payments/VirtualPaymentsPage'), 'VirtualPaymentsPage');
const AnalyticsIntelligenceCenter = lazyNamed(() => import('./pages/analytics/AnalyticsIntelligenceCenter'), 'AnalyticsIntelligenceCenter');
const ReportsDashboard = lazyNamed(() => import('./pages/reports/ReportsDashboard'), 'ReportsDashboard');
const UsersListPage = lazyNamed(() => import('./pages/admin/UsersListPage'), 'UsersListPage');
const UserManagementModern = lazyNamed(() => import('./pages/admin/UserManagementModern'), 'UserManagementModern');
const UserPermissionsPage = lazyNamed(() => import('./pages/admin/UserPermissionsPage'), 'UserPermissionsPage');
const UserDetailsPage = lazy(() => import('./pages/admin/UserDetailsPage'));
const ApprovalsDashboard = lazyNamed(() => import('./pages/admin/ApprovalsDashboard'), 'ApprovalsDashboard');
const TransportCompaniesPage = lazyNamed(() => import('./pages/admin/TransportCompaniesPage'), 'TransportCompaniesPage');
const TransportCompanyForm = lazyNamed(() => import('./pages/admin/TransportCompanyForm'), 'TransportCompanyForm');
const RefineryForm = lazyNamed(() => import('./pages/admin/RefineryForm'), 'RefineryForm');
const RefineriesPage = lazyNamed(() => import('./pages/admin/RefineriesPage'), 'RefineriesPage');
const ParametersPage = lazyNamed(() => import('./pages/admin/ParametersPage'), 'ParametersPage');
const GoldShippingWorkflow = lazy(() => import('./pages/admin/GoldShippingWorkflow'));
const GoldSalesSettingsPage = lazy(() => import('./pages/admin/GoldSalesSettingsPage'));
const StatusManagerPage = lazy(() => import('./pages/admin/StatusManagerPage'));
const ModulesManagement = lazy(() => import('./pages/admin/ModulesManagement'));
const MessageriePage = lazy(() => import('./pages/admin/MessageriePage'));
const MessagerieForm = lazy(() => import('./pages/admin/MessagerieForm'));
const InventoryManagement = lazyNamed(() => import('./pages/inventory/InventoryManagement'), 'InventoryManagement');
const AddInventoryEntry = lazyNamed(() => import('./pages/inventory/AddInventoryEntry'), 'AddInventoryEntry');
const SilverInventoryManagement = lazyNamed(() => import('./pages/inventory/SilverInventoryManagement'), 'SilverInventoryManagement');
const MiningCompaniesPage = lazyNamed(() => import('./pages/stakeholders/MiningCompaniesPage'), 'MiningCompaniesPage');
const MiningCompanyForm = lazyNamed(() => import('./pages/stakeholders/MiningCompanyForm'), 'MiningCompanyForm');
const MiningCompanyDetails = lazyNamed(() => import('./pages/stakeholders/MiningCompanyDetails'), 'MiningCompanyDetails');
const FreightCompaniesPage = lazyNamed(() => import('./pages/stakeholders/FreightCompaniesPage'), 'FreightCompaniesPage');
const RefineryPlantsPage = lazyNamed(() => import('./pages/stakeholders/RefineryPlantsPage'), 'RefineryPlantsPage');
const DepositorsPage = lazyNamed(() => import('./pages/stakeholders/DepositorsPage'), 'DepositorsPage');
const DepositorFormPage = lazyNamed(() => import('./pages/stakeholders/DepositorFormPage'), 'DepositorFormPage');
const DailyProductionPage = lazyNamed(() => import('./pages/production/DailyProductionPage'), 'DailyProductionPage');
const ProductionDetails = lazyNamed(() => import('./pages/production/ProductionDetails'), 'ProductionDetails');
const ProductionInSafe = lazyNamed(() => import('./pages/production/ProductionInSafe'), 'ProductionInSafe');
const BudgetManagementPage = lazyNamed(() => import('./pages/production/BudgetManagementPage'), 'BudgetManagementPage');
const ExportLicensesPage = lazyNamed(() => import('./pages/production/ExportLicensesPage'), 'ExportLicensesPage');
const ExportLicenseForm = lazyNamed(() => import('./pages/production/ExportLicenseForm'), 'ExportLicenseForm');
const ExportLicenseDetails = lazyNamed(() => import('./pages/production/ExportLicenseDetails'), 'ExportLicenseDetails');
const ForecastManagementPage = lazyNamed(() => import('./pages/performance/ForecastManagementPage'), 'ForecastManagementPage');
const ShippingDashboard = lazy(() => import('./pages/shipping/ShippingDashboard'));
const ShippingPreparationNew = lazy(() => import('./pages/shipping/ShippingPreparationNew'));
const ShippingPreparationDetailsEnhanced = lazy(() => import('./pages/shipping/ShippingPreparationDetailsEnhanced'));
const ShippingPreparationEdit = lazy(() => import('./pages/shipping/ShippingPreparationEdit'));
const FreightCustomsDashboard = lazy(() => import('./pages/freight/FreightCustomsDashboard'));
const FreightCustomsDetails = lazy(() => import('./pages/freight/FreightCustomsDetails'));
const FreightCustomsCreate = lazy(() => import('./pages/freight/FreightCustomsCreate'));
const FreightShipmentDashboard = lazy(() => import('./pages/freight/FreightShipmentDashboard'));
const FreightShipmentCreate = lazy(() => import('./pages/freight/FreightShipmentCreate'));
const FreightShipmentDetails = lazy(() => import('./pages/freight/FreightShipmentDetails'));
const FreightShipmentsRefining = lazy(() => import('./pages/refining/FreightShipmentsRefining'));
const ArtisanMinierDashboard = lazy(() => import('./pages/artisan-minier/ArtisanMinierDashboard'));
const ArtisanMinierListe = lazy(() => import('./pages/artisan-minier/ArtisanMinierListe'));
const ArtisanMinierDetails = lazy(() => import('./pages/artisan-minier/ArtisanMinierDetails'));
const ArtisanMinierEdit = lazy(() => import('./pages/artisan-minier/ArtisanMinierEdit'));
const CarteSuivi = lazy(() => import('./pages/artisan-minier/CarteSuivi'));
const CarteValidation = lazy(() => import('./pages/artisan-minier/CarteValidation'));
const CarteExpirations = lazy(() => import('./pages/artisan-minier/CarteExpirations'));
const VentesOr = lazy(() => import('./pages/artisan-minier/VentesOr'));
const VenteOrForm = lazy(() => import('./pages/artisan-minier/VenteOrForm'));
const VenteOrDetails = lazy(() => import('./pages/artisan-minier/VenteOrDetails'));
const InfractionForm = lazy(() => import('./pages/artisan-minier/InfractionForm'));
const InfractionDetails = lazy(() => import('./pages/artisan-minier/InfractionDetails'));
const PaiementsVentesDashboard = lazy(() => import('./pages/artisan-minier/PaiementsVentesDashboard'));
const PaiementForm = lazy(() => import('./pages/artisan-minier/PaiementForm'));
const PaiementsHistorique = lazy(() => import('./pages/artisan-minier/PaiementsHistorique'));
const CentreRapportsAnalyse = lazy(() => import('./pages/artisan-minier/CentreRapportsAnalyse'));
const RapportChiffreAffaires = lazy(() => import('./pages/artisan-minier/RapportChiffreAffaires'));
const RapportQuantites = lazy(() => import('./pages/artisan-minier/RapportQuantites'));
const RapportTaxesRoyalties = lazy(() => import('./pages/artisan-minier/RapportTaxesRoyalties'));
const ArtisanalSiteProduction = lazy(() => import('./pages/artisanal-sites/ArtisanalSiteProduction'));

const AchatsMines = lazy(() => import('./pages/production/AchatsMines'));
const PlansAchatPage = lazy(() => import('./pages/achats/PlansAchatPage'));
const PlanAchatDetails = lazy(() => import('./pages/achats/PlanAchatDetails'));
const DemandesAchatPage = lazy(() => import('./pages/achats/DemandesAchatPage'));
const ReglementsAchatPage = lazy(() => import('./pages/achats/ReglementsAchatPage'));
const ReglementForm = lazy(() => import('./pages/achats/ReglementForm'));
const ComptesMinesPage = lazy(() => import('./pages/achats/ComptesMinesPage'));
const ContratsPage = lazy(() => import('./pages/contrats/ContratsPage'));
const PilotageContrats = lazy(() => import('./pages/contrats/PilotageContrats'));
const ContratForm = lazy(() => import('./pages/contrats/ContratForm'));
const ContratDetails = lazy(() => import('./pages/contrats/ContratDetails'));
const RequisitionsPage = lazy(() => import('./pages/requisitions/RequisitionsPage'));
const RequisitionForm = lazy(() => import('./pages/requisitions/RequisitionForm'));
const RequisitionDetails = lazy(() => import('./pages/requisitions/RequisitionDetails'));
const FactureVente = lazy(() => import('./pages/artisan-minier/FactureVente'));
const ArtisanalSitesOverview = lazy(() => import('./pages/artisanal-sites/ArtisanalSitesOverview'));
const ArtisanalSiteForm = lazy(() => import('./pages/artisanal-sites/ArtisanalSiteForm'));
const ApprobateursPage = lazy(() => import('./pages/stakeholders/ApprobateursPage'));
const MinePortalPage = lazy(() => import('./pages/mine/MinePortalPage'));
const ManagerPortalPage = lazy(() => import('./pages/manager/ManagerPortalPage'));
const RecoverPassword = lazy(() => import('./pages/auth/RecoverPassword'));
const UpdatePassword = lazy(() => import('./pages/auth/UpdatePassword'));

function AppRoutes() {
  const location = useLocation();

  // `key={location.pathname}` remontait tout le sous-arbre a chaque navigation :
  // mise en page, barre laterale et filtres repartaient de zero. La cle passe en
  // propriete — seul l'etat d'erreur est efface, les enfants restent montes.
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Pages publiques, redirections et ecrans sans habillage propre. */}
          {/* Pages publiques et ecrans sans habillage propre. */}
          {/* Espace applicatif : l'habillage — barre laterale, en-tete, pied — est
              monte par cette route parente et survit aux navigations. `MainLayout`
              n'etant plus qu'une enveloppe de `NationalDashboardLayout`, les pages
              qui l'emploient y ont leur place : a l'interieur, le composant devient
              un passe-plat et l'habillage n'est monte qu'une fois. */}
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

          <Route path="/recuperer-acces" element={<RecoverPassword />} />
          <Route path="/modifier-mot-de-passe" element={<UpdatePassword />} />

          <Route
            path="/portail-mine/*"
            element={
              <MinePortalGuard>
                <MinePortalPage />
              </MinePortalGuard>
            }
          />

          <Route
            path="/portail-direction/*"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerPortalPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <HelpCenter />
              </ProtectedRoute>
            }
          />

          <Route path="/settings" element={<Navigate to="/parameters" replace />} />

          <Route element={<NationalDashboardChrome />}>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <GlobalDashboardEnhanced />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/production-modern"
              element={
                <ProtectedRoute>
                  <ProductionDashboardModern />
                </ProtectedRoute>
              }
            />

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
              path="/artisan-minier/ventes-or/:id/facture"
              element={
                <ProtectedRoute>
                  <FactureVente />
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
              path="/payments"
              element={
                <ProtectedRoute>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />

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

            <Route
              path="/production/achats-mines"
              element={
                <ProtectedRoute>
                  <AchatsMines />
                </ProtectedRoute>
              }
            />

            {/* Achats d'or industriel : planification, demandes, règlements et
                comptes des mines. L'isolation entre sociétés minières est posée
                en RLS, non par ces routes. */}
            <Route
              path="/achats/plans"
              element={<ProtectedRoute><PlansAchatPage /></ProtectedRoute>}
            />
            <Route
              path="/achats/plans/:id"
              element={<ProtectedRoute><PlanAchatDetails /></ProtectedRoute>}
            />
            <Route
              path="/achats/demandes"
              element={<ProtectedRoute><DemandesAchatPage /></ProtectedRoute>}
            />
            <Route
              path="/achats/reglements"
              element={<ProtectedRoute><ReglementsAchatPage /></ProtectedRoute>}
            />
            <Route
              path="/achats/reglements/nouveau"
              element={<ProtectedRoute><ReglementForm /></ProtectedRoute>}
            />
            <Route
              path="/achats/comptes"
              element={<ProtectedRoute><ComptesMinesPage /></ProtectedRoute>}
            />

            {/* Contrats de fourniture : le formulaire s'ouvre en page pleine, jamais
                en tiroir. « nouveau » precede « :id » pour ne pas etre capte par lui. */}
            <Route
              path="/contrats"
              element={<ProtectedRoute><ContratsPage /></ProtectedRoute>}
            />
            <Route
              path="/contrats/pilotage"
              element={<ProtectedRoute><PilotageContrats /></ProtectedRoute>}
            />
            <Route
              path="/contrats/nouveau"
              element={<ProtectedRoute><ContratForm /></ProtectedRoute>}
            />
            <Route
              path="/contrats/:id"
              element={<ProtectedRoute><ContratDetails /></ProtectedRoute>}
            />
            <Route
              path="/contrats/:id/modifier"
              element={<ProtectedRoute><ContratForm /></ProtectedRoute>}
            />

            <Route
              path="/requisitions"
              element={<ProtectedRoute><RequisitionsPage /></ProtectedRoute>}
            />
            <Route
              path="/requisitions/nouvelle"
              element={<ProtectedRoute><RequisitionForm /></ProtectedRoute>}
            />
            <Route
              path="/requisitions/:id"
              element={<ProtectedRoute><RequisitionDetails /></ProtectedRoute>}
            />
            <Route
              path="/requisitions/:id/modifier"
              element={<ProtectedRoute><RequisitionForm /></ProtectedRoute>}
            />

            <Route
              path="/production/daily"
              element={
                <ProtectedRoute allowedRoles={['factory', 'management']}>
                  <DailyProductionPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/production/licenses"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ExportLicensesPage />
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

            {/* La messagerie porte le secret SMTP : réservée à la direction, comme
                les autres écrans d'administration. Le contrôle qui compte reste en
                base — la table est illisible depuis un compte d'application. */}
            <Route
              path="/admin/messagerie"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <MessageriePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/messagerie/nouveau"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <MessagerieForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/messagerie/:uid"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <MessagerieForm />
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
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
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
              path="/sales/approve/:saleId"
              element={
                <ProtectedRoute>
                  <CustomerSaleApproval />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales/approve/:saleId/:token"
              element={
                <ProtectedRoute>
                  <CustomerSaleApproval />
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

            {/* L'écran de saisie qui vivait ici affichait une vente inventée et
                n'enregistrait rien : son bouton se contentait de revenir en
                arrière. Le règlement se saisit sur l'écran qui l'enregistre. */}
            <Route path="/customers/:id/payments" element={<Navigate to="/payments/create" replace />} />

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
              path="/reports"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.REPORTS_VIEW}>
                  <ReportsDashboard />
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

            <Route
              path="/performance/forecasts"
              element={
                <ProtectedRoute allowedRoles={['management']}>
                  <ForecastManagementPage />
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
              path="/stakeholders/approvers"
              element={
                <ProtectedRoute allowedRoles={['management', 'admin']}>
                  <ApprobateursPage />
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
              path="/audit"
              element={
                <ProtectedRoute requiredPermission={PERMISSIONS.AUDIT_VIEW}>
                  <AuditTrailPage />
                </ProtectedRoute>
              }
            />

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

          </Route>
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

function PrivateApp() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <DialogProvider>
            <AppErrorBoundary>
              <MandatoryMfaGate>
                <AppRoutes />
              </MandatoryMfaGate>
            </AppErrorBoundary>
          </DialogProvider>
        </NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default PrivateApp;
