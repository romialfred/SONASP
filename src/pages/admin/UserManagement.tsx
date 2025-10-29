import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserPlus, ArrowLeft, Lock, Unlock, Shield, Save, X, Key,
  LayoutDashboard, Package, Truck, FlaskConical, Users,
  ShoppingCart, TrendingUp, DollarSign, BarChart3, FileText,
  Settings, GitBranch, Info, AlertCircle
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { safeFetch } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { logUserAction } from '@/lib/auditLog';
import type { UserRole } from '@/types/auth';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  phone?: string | null;
  site_ids: string[];
  mining_company_names?: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface FieldPermission {
  field_name: string;
  can_view: boolean;
  can_edit: boolean;
}

interface ModulePermissions {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  field_permissions: FieldPermission[];
}

type ViewMode = 'list' | 'create' | 'edit';

// Country codes for phone numbers
const COUNTRY_CODES = [
  { code: '+224', country: 'Guinea', flag: '🇬🇳' },
  { code: '+225', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
];

// Generate secure random password
const generateSecurePassword = (): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  let password = '';

  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly (total 12 characters)
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Menu structure from AccordionSidebar
const MENU_STRUCTURE = {
  overview: {
    label: 'Overview',
    icon: LayoutDashboard,
    color: 'blue',
    features: [
      { name: 'dashboard', label: 'Dashboard', path: '/dashboard' }
    ]
  },
  batches: {
    label: 'Batches Management',
    icon: Package,
    color: 'green',
    features: [
      { name: 'batches', label: 'Batches', path: '/batches', sensitiveFields: ['weight_grams', 'final_purity_percent', 'assay_value'] },
      { name: 'shipping', label: 'Shipping', path: '/shipping', sensitiveFields: ['declared_value', 'insurance_amount'] },
      { name: 'refining', label: 'Refining', path: '/refining', sensitiveFields: ['pre_melting_weight', 'post_melting_weight', 'fineness_percent', 'metal_retained_percent', 'final_fine_grams'] }
    ]
  },
  sales: {
    label: 'Sales Management',
    icon: ShoppingCart,
    color: 'amber',
    features: [
      { name: 'customers', label: 'Customers', path: '/customers', sensitiveFields: ['credit_limit', 'total_purchases'] },
      { name: 'sales', label: 'Sales', path: '/sales', sensitiveFields: ['sale_price_per_oz', 'total_amount', 'net_proceeds', 'commission_amount'] },
      { name: 'payments', label: 'Payments', path: '/payments', sensitiveFields: ['amount', 'fx_rate', 'bank_name', 'account_number', 'reference_number', 'transaction_id'] },
      { name: 'gold_prices', label: 'Gold Prices', path: '/gold-prices', sensitiveFields: ['london_am_rate', 'london_pm_rate', 'spot_price'] },
      { name: 'fx_rates', label: 'FX Rates', path: '/fx-rates', sensitiveFields: ['usd_cfa_rate', 'usd_gnf_rate', 'exchange_spread'] }
    ]
  },
  insights: {
    label: 'Insights & Reports',
    icon: BarChart3,
    color: 'indigo',
    features: [
      { name: 'analytics', label: 'Analytics', path: '/analytics' },
      { name: 'reports', label: 'Reports', path: '/reports', sensitiveFields: ['financial_data', 'profit_margins'] }
    ]
  },
  administration: {
    label: 'Administration',
    icon: Settings,
    color: 'red',
    features: [
      { name: 'users', label: 'Users Management', path: '/users' },
      { name: 'parameters', label: 'Parameters', path: '/parameters', sensitiveFields: ['system_settings', 'api_keys'] },
      { name: 'workflow', label: 'Workflow', path: '/admin/workflow' },
      { name: 'audit', label: 'Audit Trail', path: '/audit' }
    ]
  }
};

const FIELD_GUIDANCE = {
  fullName: {
    title: 'Full Name',
    description: 'Legal name for official records',
    example: 'John Smith',
    required: true,
    color: 'blue'
  },
  email: {
    title: 'Email Address',
    description: 'Primary login and notifications',
    example: 'john.smith@company.com',
    required: true,
    color: 'blue'
  },
  phone: {
    title: 'Phone Number',
    description: 'Contact with country code',
    example: '+224 234 567 8900',
    required: false,
    color: 'blue'
  },
  role: {
    title: 'User Role',
    description: 'Primary responsibility and permissions',
    options: {
      management: 'Full access',
      factory: 'Create batches',
      airport: 'Receive shipments',
      refinery: 'Process refining',
      customer: 'View sales'
    },
    required: true,
    color: 'amber'
  },
  site: {
    title: 'Mining Companies',
    description: 'Companies user can access and manage',
    example: 'Select one or multiple companies',
    required: true,
    color: 'green'
  },
  password: {
    title: 'Initial Password',
    description: 'Temporary password for first login',
    requirements: ['Min 8 chars', 'One uppercase', 'One number'],
    required: true,
    color: 'amber'
  },
  permissions: {
    title: 'Module Permissions',
    description: 'Control access per module',
    levels: {
      view: 'View only',
      create: 'Add new',
      edit: 'Modify',
      delete: 'Remove',
      approve: 'Authorize'
    },
    color: 'green'
  },
  fieldPermissions: {
    title: 'Sensitive Fields',
    description: 'Access to confidential data',
    examples: ['Prices', 'Purity %', 'Amounts', 'Credit limits'],
    color: 'green'
  }
};

export function UserManagement() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('overview');
  const [activeFeature, setActiveFeature] = useState('dashboard');
  const [showGuidance, setShowGuidance] = useState(true);
  const [activeGuidanceField, setActiveGuidanceField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    countryCode: '+224',
    role: '' as UserRole | '',
    siteIds: [] as string[],
    password: '',
    isActive: true,
  });

  const [permissions, setPermissions] = useState<Record<string, ModulePermissions>>({});

  useEffect(() => {
    fetchUsers();
    fetchMiningCompanies();
    initializePermissions();

    const mode = searchParams.get('mode');
    const userId = searchParams.get('userId');
    if (mode === 'create') {
      setViewMode('create');
      setActiveCategory('overview');
      setActiveFeature('dashboard');
    } else if (mode === 'edit' && userId) {
      setViewMode('edit');
      setSelectedUserId(userId);
      loadUserData(userId);
    }
  }, [searchParams]);

  const initializePermissions = () => {
    const initialPerms: Record<string, ModulePermissions> = {};

    Object.entries(MENU_STRUCTURE).forEach(([category, config]) => {
      config.features.forEach(feature => {
        initialPerms[feature.name] = {
          module_name: feature.name,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
          field_permissions: (feature.sensitiveFields || []).map(field => ({
            field_name: field,
            can_view: false,
            can_edit: false
          }))
        };
      });
    });

    setPermissions(initialPerms);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[UserManagement] No session found');
        throw new Error('Not authenticated');
      }

      console.log('[UserManagement] Fetching users from Edge Function');

      const result = await safeFetch<{ users?: any[] }>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!result.ok) {
        console.warn('[UserManagement] Edge Function error, falling back to direct query:', result.error);

        const { data: usersData, error: dbError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbError) {
          console.error('[UserManagement] Database query error:', dbError);
          addToast('Failed to fetch users', 'error');
          setUsers([]);
          return;
        }

        if (usersData && Array.isArray(usersData)) {
          const { data: assignments } = await supabase
            .from('user_site_assignments')
            .select(`
              user_id,
              site_id,
              sites:site_id(name)
            `);

          const assignmentMap = new Map<string, { site_ids: string[]; company_names: string[] }>();
          if (assignments) {
            assignments.forEach((assignment: any) => {
              if (!assignmentMap.has(assignment.user_id)) {
                assignmentMap.set(assignment.user_id, { site_ids: [], company_names: [] });
              }
              const userAssignments = assignmentMap.get(assignment.user_id)!;
              userAssignments.site_ids.push(assignment.site_id);
              if (assignment.sites?.name) {
                userAssignments.company_names.push(assignment.sites.name);
              }
            });
          }

          const processedUsers: User[] = usersData
            .filter((profile: any) => profile && profile.id && profile.email)
            .map((profile: any) => {
              const userAssignments = assignmentMap.get(profile.id) || { site_ids: [], company_names: [] };
              return {
                id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                role: profile.role,
                phone: profile.phone,
                site_ids: userAssignments.site_ids,
                mining_company_names: userAssignments.company_names,
                is_active: profile.is_active !== false,
                last_login_at: profile.last_login_at,
                created_at: profile.created_at,
              };
            });

          console.log('[UserManagement] Fetched users via fallback:', processedUsers.length);
          setUsers(processedUsers);
        } else {
          setUsers([]);
        }
        return;
      }

      console.log('[UserManagement] Edge Function response status:', result.status);

      const fetchedUsers = result.data?.users;

      console.log('[UserManagement] Fetched users:', fetchedUsers);

      if (!fetchedUsers || !Array.isArray(fetchedUsers)) {
        console.error('[UserManagement] Invalid users data:', fetchedUsers);
        setUsers([]);
        addToast('No users data received', 'warning');
        return;
      }

      const { data: assignments } = await supabase
        .from('user_site_assignments')
        .select(`
          user_id,
          site_id,
          sites:site_id(name)
        `);

      const assignmentMap = new Map<string, { site_ids: string[]; company_names: string[] }>();
      if (assignments) {
        assignments.forEach((assignment: any) => {
          if (!assignmentMap.has(assignment.user_id)) {
            assignmentMap.set(assignment.user_id, { site_ids: [], company_names: [] });
          }
          const userAssignments = assignmentMap.get(assignment.user_id)!;
          userAssignments.site_ids.push(assignment.site_id);
          if (assignment.sites?.name) {
            userAssignments.company_names.push(assignment.sites.name);
          }
        });
      }

      const usersData: User[] = fetchedUsers
        .filter((profile: any) => profile && profile.id && profile.email)
        .map((profile: any) => {
          const userAssignments = assignmentMap.get(profile.id) || { site_ids: [], company_names: [] };
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            phone: profile.phone,
            site_ids: userAssignments.site_ids,
            mining_company_names: userAssignments.company_names,
            is_active: profile.is_active !== false,
            last_login_at: profile.last_login_at,
            created_at: profile.created_at,
          };
        });

      console.log('[UserManagement] Processed users:', usersData.length, 'users');
      setUsers(usersData);
    } catch (error: any) {
      console.error('[UserManagement] Error in fetchUsers:', error);
      addToast(error.message || 'Failed to fetch users', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, code, country, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
      console.log('[UserManagement] Loaded mining companies:', data?.length || 0);
    } catch (error: any) {
      console.error('Failed to fetch mining companies:', error);
      addToast('Failed to load mining companies', 'error');
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      const user = users.find(u => u.id === userId);
      if (user) {
        setFormData({
          fullName: user.full_name || '',
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          siteIds: user.site_ids,
          password: '',
          isActive: user.is_active,
        });
      }

      // Load user permissions from database
      const { data: userPermissions } = await supabase
        .from('user_permissions')
        .select(`
          *,
          modules:module_id (
            id,
            name,
            display_name
          )
        `)
        .eq('user_id', userId);

      if (userPermissions && userPermissions.length > 0) {
        const loadedPermissions: Record<string, ModulePermissions> = {};

        userPermissions.forEach((perm: any) => {
          const moduleName = perm.modules?.name;
          if (moduleName) {
            // Parse field_permissions from jsonb
            let fieldPerms: FieldPermission[] = [];
            if (perm.field_permissions && typeof perm.field_permissions === 'object') {
              fieldPerms = Object.entries(perm.field_permissions).map(([fieldName, fieldPerm]: [string, any]) => ({
                field_name: fieldName,
                can_view: fieldPerm.can_view || fieldPerm.read || false,
                can_edit: fieldPerm.can_edit || fieldPerm.write || false,
              }));
            }

            loadedPermissions[moduleName] = {
              module_name: moduleName,
              can_view: perm.can_read || false,
              can_create: false,
              can_edit: perm.can_write || false,
              can_delete: perm.can_delete || false,
              can_approve: false,
              field_permissions: fieldPerms,
            };
          }
        });

        setPermissions(loadedPermissions);
      } else {
        // No permissions found, initialize with default
        initializePermissions();
      }
    } catch (error: any) {
      addToast('Failed to load user data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    if (!currentUser || !formData.email || !formData.role) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    if (viewMode === 'create' && !formData.password) {
      addToast('Password is required for new users', 'error');
      return;
    }

    setSaving(true);
    try {
      if (viewMode === 'create') {
        // Create user via Edge Function
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              full_name: formData.fullName,
              phone: formData.phone,
              role: formData.role,
              is_active: formData.isActive,
              permissions: permissions,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create user');
        }

        addToast('User created successfully', 'success');
      } else if (viewMode === 'edit' && selectedUserId) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            full_name: formData.fullName,
            phone: formData.phone || null,
            role: formData.role,
            is_active: formData.isActive,
          })
          .eq('id', selectedUserId);

        if (profileError) throw profileError;

        // Save permissions to database
        if (permissions && Object.keys(permissions).length > 0) {
          // First, get all module IDs
          const { data: modules } = await supabase
            .from('modules')
            .select('id, name');

          if (modules) {
            // Delete existing permissions
            await supabase
              .from('user_permissions')
              .delete()
              .eq('user_id', selectedUserId);

            // Prepare new permissions with module IDs
            const permissionsToInsert = Object.entries(permissions)
              .filter(([_, perm]) => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_approve)
              .map(([moduleName, perm]) => {
                const module = modules.find(m => m.name === moduleName);
                if (!module) return null;

                // Convert field permissions to proper format
                const fieldPermsObject: Record<string, { can_view: boolean; can_edit: boolean }> = {};
                if (perm.field_permissions && Array.isArray(perm.field_permissions)) {
                  perm.field_permissions.forEach(fp => {
                    fieldPermsObject[fp.field_name] = {
                      can_view: fp.can_view,
                      can_edit: fp.can_edit
                    };
                  });
                }

                return {
                  user_id: selectedUserId,
                  module_id: module.id,
                  can_read: perm.can_view || false,
                  can_write: perm.can_edit || false,
                  can_delete: perm.can_delete || false,
                  field_permissions: fieldPermsObject,
                  granted_by: currentUser.id,
                };
              })
              .filter(p => p !== null);

            if (permissionsToInsert.length > 0) {
              const { error: permError } = await supabase
                .from('user_permissions')
                .insert(permissionsToInsert);

              if (permError) {
                console.error('Error saving permissions:', permError);
                addToast('User updated but permissions may not have been saved', 'warning');
              }
            }
          }
        }

        await logUserAction(
          currentUser.id,
          currentUser.email,
          'UPDATE',
          formData.email,
          `Updated user with role: ${formData.role}`
        );

        addToast('User updated successfully', 'success');
      }

      setSearchParams({});
      setViewMode('list');
      fetchUsers();
    } catch (error: any) {
      addToast(error.message || 'Failed to save user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    if (!currentUser) return;

    try {
      const newStatus = !user.is_active;

      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      await logUserAction(
        currentUser.id,
        currentUser.email,
        newStatus ? 'ACTIVATE' : 'DEACTIVATE',
        user.email,
        `${newStatus ? 'Activated' : 'Deactivated'} user account`
      );

      addToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchUsers();
    } catch (error: any) {
      addToast(error.message || 'Failed to update user status', 'error');
    }
  };

  const handleCancel = () => {
    setSearchParams({});
    setViewMode('list');
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      role: '',
      siteIds: [],
      password: '',
      isActive: true,
    });
    initializePermissions();
  };

  const togglePermission = (moduleName: string, permission: keyof ModulePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        [permission]: !prev[moduleName][permission]
      }
    }));
  };

  const toggleFieldPermission = (moduleName: string, fieldName: string, permission: 'can_view' | 'can_edit') => {
    console.log(`[Permissions] Toggling ${permission} for ${fieldName} in ${moduleName}`);

    setPermissions(prev => {
      const module = prev[moduleName];
      if (!module) {
        console.error(`[Permissions] Module ${moduleName} not found`);
        return prev;
      }

      const fieldPerms = module.field_permissions.map(fp =>
        fp.field_name === fieldName
          ? { ...fp, [permission]: !fp[permission] }
          : fp
      );

      const updated = {
        ...prev,
        [moduleName]: {
          ...module,
          field_permissions: fieldPerms
        }
      };

      console.log(`[Permissions] Updated field permissions for ${fieldName}:`,
        updated[moduleName].field_permissions.find(f => f.field_name === fieldName)
      );

      return updated;
    });
  };

  const roleLabels = {
    factory: 'Factory',
    airport: 'Airport',
    refinery: 'Refinery',
    customer: 'Customer',
    management: 'Management',
  };

  const columns = [
    {
      key: 'full_name',
      label: 'NAME',
      render: (_value: any, user: User) => {
        if (!user) return 'N/A';
        return (
          <div>
            <div className="font-medium text-gray-900">
              {user.full_name || (user.email ? user.email.split('@')[0] : 'N/A')}
            </div>
            <div className="text-sm text-gray-500">{user.email || 'No email'}</div>
          </div>
        );
      },
    },
    {
      key: 'role',
      label: 'ROLE',
      render: (_value: any, user: User) => {
        if (!user || !user.role) return 'N/A';
        return (
          <StatusBadge
            label={roleLabels[user.role] || user.role}
            variant="info"
          />
        );
      },
    },
    {
      key: 'mining_company',
      label: 'MINING COMPANY',
      render: (_value: any, user: User) => {
        if (!user || !user.mining_company_names || user.mining_company_names.length === 0) {
          return <span className="text-gray-400 text-sm">Not assigned</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {user.mining_company_names.map((name, idx) => (
              <span key={idx} className="text-sm text-gray-700">
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'phone',
      label: 'PHONE',
      render: (_value: any, user: User) => (user && user.phone) ? user.phone : 'Not set',
    },
    {
      key: 'is_active',
      label: 'STATUS',
      render: (_value: any, user: User) => {
        if (!user) return 'N/A';
        return (
          <StatusBadge
            label={user.is_active ? 'Active' : 'Inactive'}
            variant={user.is_active ? 'success' : 'neutral'}
          />
        );
      },
    },
    {
      key: 'last_login_at',
      label: 'LAST LOGIN',
      render: (_value: any, user: User) => {
        if (!user) return 'Never';
        return user.last_login_at
          ? new Date(user.last_login_at).toLocaleString()
          : 'Never';
      },
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (_value: any, user: User) => {
        if (!user) return null;
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchParams({ mode: 'edit', userId: user.id });
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Edit User"
            >
              <Shield className="h-4 w-4 text-primary-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleUserStatus(user);
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title={user.is_active ? 'Deactivate' : 'Activate'}
            >
              {user.is_active ? (
                <Lock className="h-4 w-4 text-red-600" />
              ) : (
                <Unlock className="h-4 w-4 text-accent-600" />
              )}
            </button>
          </div>
        );
      },
    },
  ];

  const filteredUsers = users.filter((user) => {
    if (!user) return false;
    const matchesSearch =
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        enabled
          ? 'bg-emerald-600 focus:ring-emerald-500 hover:bg-emerald-700'
          : 'bg-gray-300 focus:ring-gray-400 hover:bg-gray-400'
      }`}
      aria-pressed={enabled}
      aria-label={enabled ? 'Enabled' : 'Disabled'}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const GuidancePanel = ({ field }: { field: string | null }) => {
    const focusedField = field;

    // Color schemes with transparency
    const colorSchemes: Record<string, { bg: string; bgFocused: string; border: string; borderFocused: string; title: string; titleFocused: string; icon: string; iconFocused: string }> = {
      blue: {
        bg: 'bg-blue-50/30',
        bgFocused: 'bg-blue-100/60',
        border: 'border-blue-200/50',
        borderFocused: 'border-blue-500',
        title: 'text-blue-800',
        titleFocused: 'text-blue-900',
        icon: 'text-blue-400',
        iconFocused: 'text-blue-600'
      },
      amber: {
        bg: 'bg-amber-50/30',
        bgFocused: 'bg-amber-100/60',
        border: 'border-amber-200/50',
        borderFocused: 'border-amber-500',
        title: 'text-amber-800',
        titleFocused: 'text-amber-900',
        icon: 'text-amber-400',
        iconFocused: 'text-amber-600'
      },
      green: {
        bg: 'bg-emerald-50/30',
        bgFocused: 'bg-emerald-100/60',
        border: 'border-emerald-200/50',
        borderFocused: 'border-emerald-500',
        title: 'text-emerald-800',
        titleFocused: 'text-emerald-900',
        icon: 'text-emerald-400',
        iconFocused: 'text-emerald-600'
      }
    };

    return (
      <div className="space-y-2.5 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {Object.entries(FIELD_GUIDANCE).map(([fieldKey, guidance]) => {
          const isFocused = focusedField === fieldKey;
          const colors = colorSchemes[guidance.color as keyof typeof colorSchemes] || colorSchemes.blue;

          return (
            <div
              key={fieldKey}
              className={`border rounded-lg p-3 transition-all ${
                isFocused
                  ? `${colors.bgFocused} ${colors.borderFocused} border-l-4 shadow-lg`
                  : `${colors.bg} ${colors.border} hover:shadow-sm`
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isFocused ? colors.iconFocused : colors.icon
                }`} />
                <div className="flex-1 min-w-0">
                  <h4 className={`font-bold text-sm mb-1 ${
                    isFocused ? colors.titleFocused : colors.title
                  }`}>
                    {guidance.title}
                    {guidance.required && <span className="text-red-600 ml-1">*</span>}
                  </h4>
                  <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
                    {guidance.description}
                  </p>
                  {guidance.example && (
                    <p className="text-xs text-gray-500 italic">
                      Ex: {guidance.example}
                    </p>
                  )}
                  {guidance.options && (
                    <ul className="mt-1.5 space-y-0.5">
                      {Object.entries(guidance.options).map(([key, desc]) => (
                        <li key={key} className="text-xs text-gray-600">
                          <span className="font-semibold capitalize text-gray-700">{key}:</span> {desc}
                        </li>
                      ))}
                    </ul>
                  )}
                  {guidance.requirements && (
                    <ul className="mt-1.5 space-y-0.5">
                      {guidance.requirements.map((req, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 text-amber-500" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  )}
                  {guidance.levels && (
                    <ul className="mt-1.5 space-y-0.5">
                      {Object.entries(guidance.levels).map(([level, desc]) => (
                        <li key={level} className="text-xs text-gray-600">
                          <span className="font-semibold capitalize text-gray-700">{level}:</span> {desc}
                        </li>
                      ))}
                    </ul>
                  )}
                  {guidance.examples && (
                    <div className="mt-1.5">
                      <ul className="space-y-0.5">
                        {guidance.examples.map((ex, idx) => (
                          <li key={idx} className="text-xs text-gray-600">
                            • {ex}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                User Management
              </h1>
              <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
            </div>
            <Button
              onClick={() => setSearchParams({ mode: 'create' })}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add New User
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                <p className="text-sm text-gray-600 mt-1">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-accent-600">
                  {users.filter(u => u.is_active).length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Active Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-primary-600">
                  {users.filter(u => u.role === 'management').length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Administrators</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.role === 'customer').length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Customer Users</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  <option value="management">Management</option>
                  <option value="factory">Factory</option>
                  <option value="airport">Airport</option>
                  <option value="refinery">Refinery</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-2 text-gray-600">Loading users...</p>
                  </div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No users found</p>
                  <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
                </div>
              ) : (
                <Table
                  columns={columns}
                  data={filteredUsers}
                  onRowClick={(user) => user && setSearchParams({ mode: 'edit', userId: user.id })}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const currentCategory = MENU_STRUCTURE[activeCategory as keyof typeof MENU_STRUCTURE];
  const currentFeature = currentCategory?.features.find(f => f.name === activeFeature);
  const currentPermissions = permissions[activeFeature];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Users
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {viewMode === 'create' ? 'Add New User' : 'Edit User'}
              </h1>
              <p className="text-gray-600 mt-1">
                {viewMode === 'create'
                  ? 'Create a new user account and configure permissions'
                  : `Editing: ${formData.email}`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveUser} loading={saving}>
              <Save className="h-4 w-4 mr-2" />
              {viewMode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content - Left Side */}
          <div className={showGuidance ? 'col-span-8' : 'col-span-12'}>
            {/* Primary Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveCategory('overview');
                    setActiveFeature('dashboard');
                  }}
                  className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                    activeCategory === 'overview'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  User Information
                </button>
                <button
                  onClick={() => {
                    if (activeCategory === 'overview') {
                      setActiveCategory('batches');
                      setActiveFeature('batches');
                    }
                  }}
                  className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                    activeCategory !== 'overview'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Permissions
                </button>
              </nav>
            </div>

            {activeCategory === 'overview' ? (
              <Card>
                <CardHeader>
                  <CardTitle>User Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Full Name" required>
                      <Input
                        placeholder="Enter full name"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        onFocus={() => setActiveGuidanceField('fullName')}
                      />
                    </FormField>

                    <FormField label="Email Address" required>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={viewMode === 'edit'}
                        onFocus={() => setActiveGuidanceField('email')}
                      />
                    </FormField>

                    <FormField label="Phone Number">
                      <div className="flex gap-2">
                        <Select
                          value={formData.countryCode}
                          onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                          className="w-32"
                          onFocus={() => setActiveGuidanceField('phone')}
                        >
                          {COUNTRY_CODES.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.flag} {country.code}
                            </option>
                          ))}
                        </Select>
                        <Input
                          type="tel"
                          placeholder="234 567 8900"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d\s]/g, '') })}
                          onFocus={() => setActiveGuidanceField('phone')}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Full number: {formData.countryCode} {formData.phone}
                      </p>
                    </FormField>

                    <FormField label="Role" required>
                      <Select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                        onFocus={() => setActiveGuidanceField('role')}
                      >
                        <option value="">Select role</option>
                        <option value="factory">Factory</option>
                        <option value="airport">Airport</option>
                        <option value="refinery">Refinery</option>
                        <option value="customer">Customer</option>
                        <option value="management">Management</option>
                      </Select>
                    </FormField>

                    <FormField label="Mining Companies Assignment" required>
                      <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                        <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-200 mb-2">
                          <input
                            type="checkbox"
                            checked={formData.siteIds.length === miningCompanies.length && miningCompanies.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, siteIds: miningCompanies.map(mc => mc.id) });
                              } else {
                                setFormData({ ...formData, siteIds: [] });
                              }
                            }}
                            onFocus={() => setActiveGuidanceField('site')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm font-bold text-primary-700">Select All</span>
                        </label>
                        {miningCompanies.length === 0 ? (
                          <p className="text-sm text-gray-500 py-2">No mining companies available. Please create one first.</p>
                        ) : (
                          miningCompanies.map((company) => (
                            <label
                              key={company.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.siteIds.includes(company.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      siteIds: [...formData.siteIds, company.id]
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      siteIds: formData.siteIds.filter(id => id !== company.id)
                                    });
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">{company.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({company.code} - {company.country})</span>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                      {formData.siteIds.length > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          {formData.siteIds.length} compan{formData.siteIds.length === 1 ? 'y' : 'ies'} selected
                        </p>
                      )}
                    </FormField>

                    {viewMode === 'create' && (
                      <FormField label="Initial Password" required hint="User will be prompted to change on first login">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Enter temporary password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              onFocus={() => setActiveGuidanceField('password')}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const newPassword = generateSecurePassword();
                                setFormData({ ...formData, password: newPassword });
                                addToast('Secure password generated', 'success');
                              }}
                              className="whitespace-nowrap"
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Generate
                            </Button>
                          </div>
                          {formData.password && (
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <p className="text-xs font-medium text-green-800">Generated password:</p>
                              <p className="text-sm font-mono text-green-900 mt-1 break-all">{formData.password}</p>
                              <p className="text-xs text-green-700 mt-1">Make sure to copy this password before saving!</p>
                            </div>
                          )}
                        </div>
                      </FormField>
                    )}

                    <FormField label="Status">
                      <div className="flex items-center gap-3 pt-2">
                        <ToggleSwitch
                          enabled={formData.isActive}
                          onChange={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        />
                        <span className="text-sm text-gray-700">
                          {formData.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </FormField>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Vertical Category Tabs */}
                <div className="flex gap-6">
                  <div className="w-48 flex-shrink-0">
                    <nav className="space-y-1">
                      {Object.entries(MENU_STRUCTURE).map(([key, config]) => {
                        if (key === 'overview') return null;
                        const Icon = config.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              setActiveCategory(key);
                              setActiveFeature(config.features[0].name);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                              activeCategory === key
                                ? 'bg-primary-50 text-primary-700 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className={`h-5 w-5 text-${config.color}-500`} />
                            <span className="text-sm">{config.label}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>

                  <div className="flex-1">
                    {/* Horizontal Feature Tabs */}
                    <div className="border-b border-gray-200 mb-6">
                      <nav className="flex gap-2 overflow-x-auto">
                        {currentCategory?.features.map((feature) => (
                          <button
                            key={feature.name}
                            onClick={() => {
                              setActiveFeature(feature.name);
                              setActiveGuidanceField('permissions');
                            }}
                            className={`py-3 px-4 whitespace-nowrap border-b-2 font-medium text-sm transition-colors ${
                              activeFeature === feature.name
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {feature.label}
                          </button>
                        ))}
                      </nav>
                    </div>

                    {/* Permission Toggles */}
                    {currentPermissions && (
                      <Card>
                        <CardHeader>
                          <CardTitle>{currentFeature?.label} Permissions</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            Configure what the user can do in {currentFeature?.label}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {/* Module Actions */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-4">Module Actions</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {['can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve'].map((perm) => (
                                  <div key={perm} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                    <div>
                                      <div className="font-medium text-sm text-gray-900 capitalize">
                                        {perm.replace('can_', '')}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {perm === 'can_view' && 'View data'}
                                        {perm === 'can_create' && 'Add new records'}
                                        {perm === 'can_edit' && 'Modify records'}
                                        {perm === 'can_delete' && 'Delete records'}
                                        {perm === 'can_approve' && 'Approve workflows'}
                                      </div>
                                    </div>
                                    <ToggleSwitch
                                      enabled={currentPermissions[perm as keyof ModulePermissions] as boolean}
                                      onChange={() => togglePermission(activeFeature, perm as keyof ModulePermissions)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Sensitive Fields */}
                            {currentFeature?.sensitiveFields && currentFeature.sensitiveFields.length > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-red-500" />
                                  Sensitive Field Access
                                </h4>
                                <p className="text-sm text-gray-600 mb-4">
                                  Control access to confidential data like gold prices, purity percentages, and financial amounts
                                </p>
                                <div className="space-y-3">
                                  {currentPermissions.field_permissions.map((fp) => (
                                    <div key={fp.field_name} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm text-gray-900">
                                          {fp.field_name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                          <span className="text-xs text-gray-600">View</span>
                                          <ToggleSwitch
                                            enabled={fp.can_view}
                                            onChange={() => toggleFieldPermission(activeFeature, fp.field_name, 'can_view')}
                                          />
                                        </label>
                                        <label className="flex items-center gap-2">
                                          <span className="text-xs text-gray-600">Edit</span>
                                          <ToggleSwitch
                                            enabled={fp.can_edit}
                                            onChange={() => toggleFieldPermission(activeFeature, fp.field_name, 'can_edit')}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guidance Panel - Right Side */}
          {showGuidance && (
            <div className="col-span-4">
              <div className="sticky top-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Field Guidance</h3>
                  <button
                    onClick={() => setShowGuidance(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <GuidancePanel field={activeGuidanceField} />
              </div>
            </div>
          )}

          {!showGuidance && (
            <button
              onClick={() => setShowGuidance(true)}
              className="fixed right-6 top-32 bg-primary-600 text-white p-3 rounded-l-lg shadow-lg hover:bg-primary-700 transition-colors"
            >
              <Info className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
