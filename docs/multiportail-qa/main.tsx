import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { cases, currentCase, setCase, useAuth } from './auth';
import { setMode } from './supabase';
import { NationalDashboardChrome } from '../../src/components/layout/NationalDashboardLayout';
import { MinePortalGuard } from '../../src/components/auth/MinePortalGuard';
import { ProtectedRoute } from '../../src/components/auth/ProtectedRoute';
import { accountTypeFor, homePathForAccountType } from '../../src/lib/routeAccessRegistry';
import { GlobalDashboardEnhanced } from '../../src/pages/dashboards/GlobalDashboardEnhanced';
import MinePortal from '../../src/pages/mine/MinePortalPage';
import ComptoirPortal from '../../src/pages/comptoir/ComptoirPortalPage';
import CollectorPortal from '../../src/pages/collector/CollectorPortalPage';
import ManagerPortal from '../../src/pages/manager/ManagerPortalPage';
import InstitutionalPortal from '../../src/pages/portals/InstitutionalPortalPage';
import { FactoryDashboard } from '../../src/pages/dashboards/FactoryDashboard';
import { AirportDashboard } from '../../src/pages/dashboards/AirportDashboard';
import { RefineryDashboard } from '../../src/pages/dashboards/RefineryDashboard';
import { CustomerDashboard } from '../../src/pages/dashboards/CustomerDashboard';
import '../../src/index.css';
import '../../src/styles/design-system.css';
import '../../src/i18n/config';
function App(){const navigate=useNavigate();const {user}=useAuth();const location=useLocation();return <><details style={{position:'fixed',bottom:3,right:4,zIndex:1000,fontSize:11,background:'white',border:'1px solid #bac8d3',borderRadius:4,padding:3}}><summary>Banc local de vérification</summary><label>Contexte de test <select value={currentCase()} onChange={e=>{setCase(e.target.value);navigate(homePathForAccountType(accountTypeFor(useProfile()))||'/dashboard');}}>{cases.map(c=><option key={c}>{c}</option>)}</select></label><label> Données <select onChange={e=>{setMode(e.target.value);navigate(location.pathname+'?refresh='+Date.now());}}><option value="populated">Test isolé</option><option value="empty">Vide</option><option value="error">Erreur</option></select></label><button onClick={()=>navigate('/users')}>Route interdite</button><button onClick={()=>window.location.reload()}>Recharger</button></details><NationalDashboardChrome><Routes><Route path="/portail-mine" element={<ProtectedRoute><MinePortalGuard><MinePortal/></MinePortalGuard></ProtectedRoute>}/><Route path="/portail-comptoir" element={<ProtectedRoute><ComptoirPortal/></ProtectedRoute>}/><Route path="/portail-collecteur" element={<ProtectedRoute><CollectorPortal/></ProtectedRoute>}/><Route path="/portail-direction/*" element={<ProtectedRoute><ManagerPortal/></ProtectedRoute>}/><Route path="/portail-dgi" element={<ProtectedRoute><InstitutionalPortal portal="dgi"/></ProtectedRoute>}/><Route path="/portail-dgmg" element={<ProtectedRoute><InstitutionalPortal portal="dgmg"/></ProtectedRoute>}/><Route path="/dashboard/factory" element={<ProtectedRoute><FactoryDashboard/></ProtectedRoute>}/><Route path="/dashboard/airport" element={<ProtectedRoute><AirportDashboard/></ProtectedRoute>}/><Route path="/dashboard/refinery" element={<ProtectedRoute><RefineryDashboard/></ProtectedRoute>}/><Route path="/dashboard/customer" element={<ProtectedRoute><CustomerDashboard/></ProtectedRoute>}/><Route path="/dashboard" element={<ProtectedRoute><GlobalDashboardEnhanced key={location.search}/></ProtectedRoute>}/><Route path="/403" element={<div className="sn-page"><h2>Accès refusé</h2></div>}/><Route path="/users" element={<ProtectedRoute><div>Utilisateurs</div></ProtectedRoute>}/><Route path="/sales/:id" element={<ProtectedRoute><div className="sn-page"><h2>Opération de test isolée</h2><p>{location.pathname}</p></div></ProtectedRoute>}/><Route path="*" element={<div className="sn-page"><h2>Navigation de vérification</h2><p>{location.pathname}</p><a href={homePathForAccountType(accountTypeFor(user))||'/dashboard'}>Ouvrir le portail</a></div>}/></Routes></NationalDashboardChrome></>}
// This fixture changes only its own authenticated test context, never the application auth resolver.
import { getProfile as useProfile } from './auth';
ReactDOM.createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>);
