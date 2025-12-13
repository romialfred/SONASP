import { useState, useEffect } from 'react';
import { Save, X, Info, HelpCircle, Package, AlertCircle, CheckCircle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface StatusFormData {
  value: string;
  label: string;
  description: string;
  color: string;
  canTransitionTo: string[];
}

interface StatusFormPanelProps {
  status: StatusFormData | null;
  availableStatuses: Array<{ value: string; label: string }>;
  onSave: (data: StatusFormData) => void;
  onCancel: () => void;
  module: string;
}

const COLOR_OPTIONS = [
  { value: 'bg-blue-100 text-blue-800 border-blue-300', hex: '#3B82F6', label: 'Bleu' },
  { value: 'bg-amber-100 text-amber-800 border-amber-300', hex: '#F59E0B', label: 'Amber' },
  { value: 'bg-emerald-100 text-emerald-800 border-emerald-300', hex: '#10B981', label: 'Vert' },
  { value: 'bg-red-100 text-red-800 border-red-300', hex: '#EF4444', label: 'Rouge' },
  { value: 'bg-yellow-100 text-yellow-800 border-yellow-300', hex: '#EAB308', label: 'Jaune' },
  { value: 'bg-gray-100 text-gray-800 border-gray-300', hex: '#6B7280', label: 'Gris' },
  { value: 'bg-slate-100 text-slate-800 border-slate-300', hex: '#64748B', label: 'Ardoise' },
  { value: 'bg-purple-100 text-purple-800 border-purple-300', hex: '#9333EA', label: 'Violet' }
];

const HELP_CONTENT = {
  code: {
    title: 'Code du Statut',
    description: 'Identifiant unique technique du statut. Utilisé dans le code de l\'application.',
    tips: [
      'Utilisez des minuscules et underscores uniquement',
      'Exemple: prepared, ready_for_customs, cancelled',
      'Ne peut pas être modifié après création'
    ]
  },
  label: {
    title: 'Libellé',
    description: 'Nom affiché à l\'utilisateur dans toute l\'application.',
    tips: [
      'Doit être clair et compréhensible',
      'Utilisez la majuscule au début',
      'Exemple: "Préparé", "Prêt pour la Douane"'
    ]
  },
  description: {
    title: 'Description',
    description: 'Explication détaillée du statut pour les utilisateurs.',
    tips: [
      'Décrivez ce que signifie ce statut',
      'Indiquez les actions possibles',
      'Visible au survol dans l\'interface'
    ]
  },
  color: {
    title: 'Couleur',
    description: 'Couleur visuelle du badge de statut dans l\'interface.',
    tips: [
      'Utilisez des couleurs cohérentes:',
      '• Bleu pour les statuts initiaux',
      '• Amber/Jaune pour les statuts en attente',
      '• Vert pour les statuts validés',
      '• Rouge pour les erreurs/annulations'
    ]
  },
  transitions: {
    title: 'Transitions Possibles',
    description: 'Définit vers quels statuts on peut passer depuis ce statut.',
    tips: [
      'Cochez les statuts accessibles',
      'Respectez la logique métier',
      'Un statut final ne devrait avoir aucune transition',
      'Évitez les cycles (A → B → A)'
    ]
  }
};

export function StatusFormPanel({ status, availableStatuses, onSave, onCancel, module }: StatusFormPanelProps) {
  const [formData, setFormData] = useState<StatusFormData>({
    value: '',
    label: '',
    description: '',
    color: COLOR_OPTIONS[1].value,
    canTransitionTo: []
  });

  const [activeHelp, setActiveHelp] = useState<keyof typeof HELP_CONTENT>('code');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status) {
      setFormData(status);
    }
  }, [status]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.label.trim()) {
      newErrors.label = 'Le libellé est obligatoire';
    }

    if (!status && !formData.value.trim()) {
      newErrors.value = 'Le code est obligatoire';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const toggleTransition = (targetStatus: string) => {
    setFormData(prev => ({
      ...prev,
      canTransitionTo: prev.canTransitionTo.includes(targetStatus)
        ? prev.canTransitionTo.filter(s => s !== targetStatus)
        : [...prev.canTransitionTo, targetStatus]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
      <div className="min-h-screen w-full flex items-start justify-center p-6">
        <div className="w-full max-w-6xl bg-white rounded-lg shadow-xl my-6">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {status ? 'Modifier le Statut' : 'Nouveau Statut'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">Module: {module}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex">
            {/* Main Form - Left Side */}
            <div className="flex-1 p-6 space-y-6">
              {/* Code du Statut */}
              <div onFocus={() => setActiveHelp('code')}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code du Statut {!status && <span className="text-red-500">*</span>}
                </label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  disabled={!!status}
                  placeholder="ex: prepared, ready_for_customs"
                  className={errors.value ? 'border-red-500' : ''}
                />
                {errors.value && (
                  <p className="text-sm text-red-600 mt-1">{errors.value}</p>
                )}
                {status && (
                  <p className="text-xs text-gray-500 mt-1">
                    Le code ne peut pas être modifié après création
                  </p>
                )}
              </div>

              {/* Libellé */}
              <div onFocus={() => setActiveHelp('label')}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Libellé <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="ex: Préparé, Prêt pour la Douane"
                  className={errors.label ? 'border-red-500' : ''}
                />
                {errors.label && (
                  <p className="text-sm text-red-600 mt-1">{errors.label}</p>
                )}
              </div>

              {/* Description */}
              <div onFocus={() => setActiveHelp('description')}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Décrivez ce statut et son utilisation..."
                />
              </div>

              {/* Couleur */}
              <div onFocus={() => setActiveHelp('color')}>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Couleur du Badge
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {COLOR_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: option.value })}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        formData.color === option.value
                          ? 'ring-2 ring-amber-500 border-amber-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: option.hex }}
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>

                {/* Aperçu */}
                <div className="mt-4">
                  <p className="text-xs text-gray-600 mb-2">Aperçu:</p>
                  <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-semibold border ${formData.color}`}>
                    {formData.label || 'Exemple de statut'}
                  </span>
                </div>
              </div>

              {/* Transitions Possibles */}
              <div onFocus={() => setActiveHelp('transitions')}>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Transitions Possibles
                </label>
                <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                  {availableStatuses.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Aucun autre statut disponible
                    </p>
                  ) : (
                    availableStatuses
                      .filter(s => s.value !== formData.value)
                      .map(targetStatus => (
                        <label
                          key={targetStatus.value}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.canTransitionTo.includes(targetStatus.value)}
                            onChange={() => toggleTransition(targetStatus.value)}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {targetStatus.label}
                          </span>
                        </label>
                      ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="secondary"
                  onClick={onCancel}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {status ? 'Enregistrer' : 'Créer le Statut'}
                </Button>
              </div>
            </div>

            {/* Help Panel - Right Side */}
            <div className="w-80 bg-gradient-to-br from-amber-50 to-orange-50 border-l border-amber-200 p-6">
              <div className="sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-gray-900">Aide</h3>
                </div>

                <Card className="bg-white border-amber-200 shadow-sm">
                  <div className="p-4 space-y-4">
                    {/* Title */}
                    <div>
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-600" />
                        {HELP_CONTENT[activeHelp].title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-2">
                        {HELP_CONTENT[activeHelp].description}
                      </p>
                    </div>

                    {/* Tips */}
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Conseils:
                      </p>
                      <ul className="space-y-2">
                        {HELP_CONTENT[activeHelp].tips.map((tip, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Examples Section */}
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Exemples de bonnes pratiques:
                      </p>
                      <div className="space-y-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                          <p className="text-xs text-emerald-800 font-medium mb-1">✓ Bon</p>
                          <code className="text-xs text-emerald-700">
                            {activeHelp === 'code' && 'ready_for_customs'}
                            {activeHelp === 'label' && 'Prêt pour la Douane'}
                            {activeHelp === 'description' && 'Production validée et prête pour le processus douanier'}
                            {activeHelp === 'color' && 'Amber pour "en attente"'}
                            {activeHelp === 'transitions' && 'prepared → ready_for_customs'}
                          </code>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs text-red-800 font-medium mb-1">✗ Mauvais</p>
                          <code className="text-xs text-red-700">
                            {activeHelp === 'code' && 'Ready For Customs (majuscules)'}
                            {activeHelp === 'label' && 'RFC (trop court)'}
                            {activeHelp === 'description' && 'Prêt (trop vague)'}
                            {activeHelp === 'color' && 'Toujours la même couleur'}
                            {activeHelp === 'transitions' && 'completed → pending (illogique)'}
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* Warning */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-amber-900 mb-1">
                              Important
                            </p>
                            <p className="text-xs text-amber-800">
                              {activeHelp === 'code' && 'Le code ne peut jamais être modifié une fois créé. Choisissez-le avec soin.'}
                              {activeHelp === 'label' && 'Le libellé est visible par tous les utilisateurs. Utilisez un terme clair et professionnel.'}
                              {activeHelp === 'description' && 'Une bonne description aide les utilisateurs à comprendre le workflow.'}
                              {activeHelp === 'color' && 'Maintenez une cohérence visuelle entre les modules de l\'application.'}
                              {activeHelp === 'transitions' && 'Les transitions définissent le workflow. Vérifiez la logique métier avant de valider.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
