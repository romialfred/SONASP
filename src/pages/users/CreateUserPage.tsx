import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ArrowLeft, Save, Info, CheckCircle, AlertCircle, Key, Shield, Mail, Phone, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function CreateUserPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'factory',
  });
  const [creating, setCreating] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.full_name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      const defaultPassword = generateRandomPassword();

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
          phone: formData.phone,
        },
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          is_active: true,
          two_factor_enabled: true,
          password_must_change: true,
        });

      if (profileError) throw profileError;

      setGeneratedPassword(defaultPassword);
      setShowPassword(true);
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error.message}`);
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (showPassword) {
      navigate('/users');
    } else {
      if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
        navigate('/users');
      }
    }
  };

  if (showPassword) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/users')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Created Successfully</h1>
                <p className="text-gray-600 mt-1">Save the temporary password before continuing</p>
              </div>
            </div>
          </div>

          <Card>
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Account Created!</h2>
                <p className="text-gray-600">User {formData.email} has been created successfully</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-2">Important: Save This Password</h3>
                    <p className="text-sm text-amber-800 mb-3">
                      This temporary password will only be shown once. Make sure to copy it and share it securely with the user.
                    </p>
                    <div className="bg-white border border-amber-300 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Temporary Password</p>
                      <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">{generatedPassword}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-gray-900">User Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium text-gray-900">{formData.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{formData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="font-medium text-gray-900 capitalize">{formData.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{formData.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-2">Next Steps</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Share the temporary password with the user securely</li>
                  <li>User must change this password on first login</li>
                  <li>Two-factor authentication (2FA) is enabled by default</li>
                  <li>Configure user permissions from the Users page</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={() => navigate('/users')}>
                  Go to Users List
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New User</h1>
              <p className="text-gray-600 mt-1">Create a new user account with default permissions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">User Information</h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Full Name <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <Input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="John Doe"
                      className="text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email Address <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john.doe@example.com"
                      className="text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">This will be used for login and notifications</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </div>
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional: For contact purposes</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        User Role <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    >
                      <option value="factory">Factory</option>
                      <option value="airport">Airport</option>
                      <option value="refinery">Refinery</option>
                      <option value="customer">Customer</option>
                      <option value="management">Management</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Determines default permissions and access level</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                  <Button
                    variant="secondary"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreateUser}
                    disabled={creating || !formData.email || !formData.full_name}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {creating ? 'Creating User...' : 'Create User'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="space-y-4 sticky top-6">
              <Card>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Quick Guide</h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>Fill in the required user information to create a new account.</p>
                    <p className="font-medium text-gray-900">Required fields:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Full Name</li>
                      <li>Email Address</li>
                      <li>User Role</li>
                    </ul>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Key className="h-5 w-5 text-amber-600" />
                    <h3 className="font-semibold text-gray-900">Security Features</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Random Password</p>
                        <p className="text-xs text-gray-600">12-character secure password generated automatically</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Force Password Change</p>
                        <p className="text-xs text-gray-600">User must set new password on first login</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">2FA Enabled</p>
                        <p className="text-xs text-gray-600">Two-factor authentication enabled by default</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Role Descriptions</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">Factory</p>
                      <p className="text-xs text-gray-600">Create batches, manage shipments</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Airport</p>
                      <p className="text-xs text-gray-600">Receive batches, confirm weights</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Refinery</p>
                      <p className="text-xs text-gray-600">Process refining, quality control</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Customer</p>
                      <p className="text-xs text-gray-600">View sales, make payments</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Management</p>
                      <p className="text-xs text-gray-600">Full system access, analytics</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
