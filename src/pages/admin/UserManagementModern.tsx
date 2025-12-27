/**
 * User Management - Version Moderne et Simplifiée
 * Interface ergonomique pour gérer les utilisateurs et permissions
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserPlus, ArrowLeft, Save, X, Shield, CheckCircle2,
  Mail, Phone, Building2, Key, Eye, Edit, Trash2, Check
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleImproved } from '@/components/ui/ToggleImproved';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createUserDirect } from '@/services/userManagementService';
import { modulesService, type Module } from '@/services/modulesService';
import type { UserRole } from '@/types/auth';

interface UserFormData {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole | '';
  miningCompanyIds: string[];
  password: string;
  isActive: boolean;
}

const ROLES: Array<{ value: UserRole; label: string; description: string }> = [
  { value: 'management', label: 'Management', description: 'Full access to all modules' },
  { value: 'factory', label: 'Factory', description: 'Create and manage batches' },
  { value: 'airport', label: 'Airport', description: 'Receive and verify shipments' },
  { value: 'refinery', label: 'Refinery', description: 'Process refining operations' },
  { value: 'customer', label: 'Customer', description: 'View sales and documents' },
];

export function UserManagementModern() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState<UserFormData>({
    fullName: '',
    email: '',
    phone: '',
    role: '',
    miningCompanyIds: [],
    password: '',
    isActive: true,
  });

  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [miningCompanies, setMiningCompanies] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    initialize();
  }, [searchParams]);

  const initialize = async () => {
    try {
      setLoading(true);

      // Charger les mining companies
      const { data: companies } = await supabase
        .from('mining_companies')
        .select('id, name, abbreviation')
        .order('name');

      setMiningCompanies(companies || []);

      // Charger les modules depuis la base de données
      const loadedModules = await modulesService.getAll();
      setModules(loadedModules);

      // Initialiser les permissions
      const initialPerms: Record<string, ModulePermission> = {};
      loadedModules.forEach(module => {
        initialPerms[module.id] = {
          module_id: module.id,
          module_name: module.name,
          display_name: module.display_name,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
        };
      });
      setPermissions(initialPerms);

      // Vérifier si mode édition
      const userId = searchParams.get('userId');
      if (userId) {
        setIsEditMode(true);
        setSelectedUserId(userId);
        await loadUserData(userId, initialPerms);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (userId: string, initialPerms: Record<string, ModulePermission>) => {
    try {
      // Charger profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Charger les assignments de mining companies
      const { data: assignments } = await supabase
        .from('user_site_assignments')
        .select('site_id')
        .eq('user_id', userId);

      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        role: profile.role || '',
        miningCompanyIds: assignments?.map(a => a.site_id) || [],
        password: '',
        isActive: profile.is_active !== false,
      });

      // Charger les permissions
      const userPerms = await loadUserPermissions(userId);

      // Fusionner avec les permissions initiales
      const mergedPerms = { ...initialPerms };
      Object.keys(userPerms).forEach(moduleId => {
        if (mergedPerms[moduleId]) {
          mergedPerms[moduleId] = userPerms[moduleId];
        }
      });

      setPermissions(mergedPerms);
    } catch (error) {
      console.error('Failed to load user data:', error);
      addToast('Failed to load user data', 'error');
    }
  };

  const generateSecurePassword = (): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword();
    setFormData({ ...formData, password: newPassword });
    addToast('Password generated', 'success');
  };

  const validateStep1 = (): boolean => {
    if (!formData.fullName.trim()) {
      addToast('Full name is required', 'error');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      addToast('Valid email is required', 'error');
      return false;
    }
    if (!formData.role) {
      addToast('Role is required', 'error');
      return false;
    }
    if (formData.miningCompanyIds.length === 0) {
      addToast('At least one mining company is required', 'error');
      return false;
    }
    if (!isEditMode && !formData.password) {
      addToast('Password is required', 'error');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!currentUser?.id) {
        addToast('Not authenticated', 'error');
        return;
      }

      let userId = selectedUserId;

      // Créer ou mettre à jour l'utilisateur
      if (!isEditMode) {
        // Mode création
        const result = await createUserDirect({
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
          phone: formData.phone,
          role: formData.role as UserRole,
          is_active: formData.isActive,
        });

        if (!result.success || !result.user) {
          addToast(result.error || 'Failed to create user', 'error');
          return;
        }

        userId = result.user.id;
      } else {
        // Mode édition
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            full_name: formData.fullName,
            phone: formData.phone,
            role: formData.role,
            is_active: formData.isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedUserId);

        if (updateError) throw updateError;
      }

      // Sauvegarder les mining company assignments
      if (userId) {
        await supabase
          .from('user_site_assignments')
          .delete()
          .eq('user_id', userId);

        const assignments = formData.miningCompanyIds.map(siteId => ({
          user_id: userId,
          site_id: siteId,
        }));

        await supabase
          .from('user_site_assignments')
          .insert(assignments);

        // Sauvegarder les permissions
        const saveResult = await saveUserPermissions(userId, permissions, currentUser.id);

        if (!saveResult.success) {
          addToast(saveResult.error || 'Failed to save permissions', 'error');
          return;
        }
      }

      addToast(
        isEditMode ? 'User updated successfully' : 'User created successfully',
        'success'
      );

      navigate('/users');
    } catch (error: any) {
      console.error('Failed to save user:', error);
      addToast(error.message || 'Failed to save user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (moduleId: string, permission: keyof ModulePermission) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [permission]: !(prev[moduleId][permission] as boolean),
      },
    }));
  };

  const setQuickPermissions = (preset: 'none' | 'view_only' | 'full') => {
    const updatedPerms = { ...permissions };

    Object.keys(updatedPerms).forEach(moduleId => {
      switch (preset) {
        case 'none':
          updatedPerms[moduleId] = {
            ...updatedPerms[moduleId],
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_approve: false,
          };
          break;
        case 'view_only':
          updatedPerms[moduleId] = {
            ...updatedPerms[moduleId],
            can_view: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_approve: false,
          };
          break;
        case 'full':
          updatedPerms[moduleId] = {
            ...updatedPerms[moduleId],
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_approve: true,
          };
          break;
      }
    });

    setPermissions(updatedPerms);
    addToast(`Permissions set to ${preset.replace('_', ' ')}`, 'success');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/users')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditMode ? 'Edit User' : 'Add New User'}
              </h1>
              <p className="text-gray-600 mt-1">
                {step === 1
                  ? 'Basic information and authentication'
                  : 'Configure module permissions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/users')}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {step === 2 && (
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-3 ${step === 1 ? 'text-blue-600' : 'text-green-600'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step === 1 ? 'bg-blue-100' : 'bg-green-100'
            }`}>
              {step === 1 ? '1' : <CheckCircle2 className="h-6 w-6" />}
            </div>
            <span className="font-medium">User Information</span>
          </div>
          <div className="flex-1 h-1 bg-gray-200 rounded">
            <div className={`h-full rounded transition-all ${step === 2 ? 'bg-blue-600 w-full' : 'w-0'}`} />
          </div>
          <div className={`flex items-center gap-3 ${step === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step === 2 ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              2
            </div>
            <span className="font-medium">Permissions</span>
          </div>
        </div>

        {/* Step 1: User Information */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <Input
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="John Smith"
                        icon={<Shield className="h-4 w-4" />}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john.smith@company.com"
                        disabled={isEditMode}
                        icon={<Mail className="h-4 w-4" />}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+224 234 567 8900"
                        icon={<Phone className="h-4 w-4" />}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        User Role *
                      </label>
                      <Select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      >
                        <option value="">Select a role</option>
                        {ROLES.map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mining Companies * (Multi-select)
                    </label>
                    <Select
                      multiple
                      value={formData.miningCompanyIds}
                      onChange={(e) => {
                        const options = Array.from(e.target.selectedOptions, option => option.value);
                        setFormData({ ...formData, miningCompanyIds: options });
                      }}
                      className="h-32"
                    >
                      {miningCompanies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name} ({company.abbreviation})
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Hold Ctrl (Cmd on Mac) to select multiple companies
                    </p>
                  </div>
                </CardContent>
              </Card>

              {!isEditMode && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-amber-600" />
                      Initial Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temporary Password *
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Enter or generate password"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={handleGeneratePassword}
                          type="button"
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Generate
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        User will be prompted to change on first login
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleNextStep}
                  size="lg"
                >
                  Next: Configure Permissions
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
            </div>

            {/* Right Column: Guide */}
            <div className="space-y-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-900">Role Descriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ROLES.map(role => (
                      <div key={role.value} className="pb-3 border-b border-blue-200 last:border-0">
                        <h4 className="font-semibold text-blue-900">{role.label}</h4>
                        <p className="text-sm text-blue-700 mt-1">{role.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                  <CardTitle className="text-amber-900">Important Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-amber-800">
                    <li>• Email cannot be changed after creation</li>
                    <li>• User will receive activation email automatically</li>
                    <li>• Password must be changed on first login</li>
                    <li>• Mining companies control data visibility</li>
                    <li>• Permissions can be adjusted anytime</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Permissions */}
        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    Module Permissions
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickPermissions('none')}
                    >
                      Clear All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickPermissions('view_only')}
                    >
                      View Only
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickPermissions('full')}
                    >
                      Full Access
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {modules.length === 0 ? (
                  <div className="py-12 text-center">
                    <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No modules found. Please create modules in the system first.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {(() => {
                      // Grouper les modules par catégorie
                      const modulesByCategory = modules.reduce((acc, module) => {
                        const category = module.category || 'other';
                        if (!acc[category]) {
                          acc[category] = [];
                        }
                        acc[category].push(module);
                        return acc;
                      }, {} as Record<string, typeof modules>);

                      // Ordre des catégories
                      const categoryOrder = ['overview', 'batches', 'sales', 'operations', 'analytics', 'system', 'other'];
                      const categoryLabels: Record<string, string> = {
                        overview: 'Overview',
                        batches: 'Batches Management',
                        sales: 'Sales Management',
                        operations: 'Operations',
                        analytics: 'Analytics & Reports',
                        system: 'System Administration',
                        other: 'Other Modules',
                      };

                      const sortedCategories = Object.keys(modulesByCategory).sort((a, b) => {
                        const indexA = categoryOrder.indexOf(a);
                        const indexB = categoryOrder.indexOf(b);
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                      });

                      return sortedCategories.map((category) => (
                        <div key={category} className="space-y-4">
                          {/* Category Header */}
                          <div className="flex items-center gap-3">
                            <div className="h-1 flex-shrink-0 w-8 bg-blue-600 rounded"></div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {categoryLabels[category] || category}
                            </h3>
                            <div className="h-px flex-1 bg-gray-200"></div>
                          </div>

                          {/* Modules Table for this category */}
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full">
                              <thead className="bg-slate-700">
                                <tr>
                                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase">
                                    Module
                                  </th>
                                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase w-28">
                                    <Eye className="h-4 w-4 mx-auto mb-1" />
                                    View
                                  </th>
                                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase w-28">
                                    <Edit className="h-4 w-4 mx-auto mb-1" />
                                    Create
                                  </th>
                                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase w-28">
                                    <Edit className="h-4 w-4 mx-auto mb-1" />
                                    Edit
                                  </th>
                                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase w-28">
                                    <Trash2 className="h-4 w-4 mx-auto mb-1" />
                                    Delete
                                  </th>
                                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase w-28">
                                    <Check className="h-4 w-4 mx-auto mb-1" />
                                    Approve
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {modulesByCategory[category].map((module, index) => {
                                  const perm = permissions[module.id];
                                  return (
                                    <tr
                                      key={module.id}
                                      className={`hover:bg-blue-50 transition-colors ${
                                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                      }`}
                                    >
                                      <td className="px-6 py-4">
                                        <div>
                                          <p className="font-semibold text-gray-900">
                                            {module.display_name}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-1">{module.description}</p>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          <ToggleImproved
                                            checked={perm?.can_view || false}
                                            onChange={() => togglePermission(module.id, 'can_view')}
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          <ToggleImproved
                                            checked={perm?.can_create || false}
                                            onChange={() => togglePermission(module.id, 'can_create')}
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          <ToggleImproved
                                            checked={perm?.can_edit || false}
                                            onChange={() => togglePermission(module.id, 'can_edit')}
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          <ToggleImproved
                                            checked={perm?.can_delete || false}
                                            onChange={() => togglePermission(module.id, 'can_delete')}
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          <ToggleImproved
                                            checked={perm?.can_approve || false}
                                            onChange={() => togglePermission(module.id, 'can_approve')}
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to User Information
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
