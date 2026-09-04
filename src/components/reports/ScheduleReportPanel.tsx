import { X, Calendar, Clock, Mail, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { reportSchedulingService } from '@/services/reportSchedulingService';

interface ScheduleReportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  reportId: string;
  onScheduled?: () => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Quotidienne',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
};

const WEEKDAY_LABELS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function ScheduleReportPanel({ isOpen, onClose, reportType, reportId, onScheduled }: ScheduleReportPanelProps) {
  const [frequency, setFrequency] = useState('weekly');
  const [recipients, setRecipients] = useState('');
  const [day, setDay] = useState('1');
  const [weekday, setWeekday] = useState('1');
  const [time, setTime] = useState('09:00');
  const [format, setFormat] = useState('pdf');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSchedule = async () => {
    try {
      setSaving(true);
      const recipientsList = recipients.split(',').map(r => r.trim()).filter(r => r);

      await reportSchedulingService.createScheduledReport({
        report_type: reportId as any,
        frequency: frequency as any,
        schedule_time: time,
        schedule_day: frequency === 'monthly' ? parseInt(day) : undefined,
        schedule_weekday: frequency === 'weekly' ? parseInt(weekday) : undefined,
        recipients: recipientsList,
        format: format as 'pdf' | 'excel'
      });

      if (onScheduled) {
        onScheduled();
      }
      onClose();
    } catch (error) {
      console.error('Error scheduling report:', error);
      alert('La planification du rapport a échoué. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Planifier le rapport</h2>
            <p className="text-sm text-gray-600 mt-1">{reportType}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4" />
              Fréquence
            </label>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full"
            >
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
              <option value="quarterly">Trimestrielle</option>
              <option value="yearly">Annuelle</option>
            </Select>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Jour de la semaine
              </label>
              <Select
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                className="w-full"
              >
                <option value="0">Dimanche</option>
                <option value="1">Lundi</option>
                <option value="2">Mardi</option>
                <option value="3">Mercredi</option>
                <option value="4">Jeudi</option>
                <option value="5">Vendredi</option>
                <option value="6">Samedi</option>
              </Select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Jour du mois
              </label>
              <Input
                type="number"
                min="1"
                max="31"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Clock className="h-4 w-4" />
              Heure
            </label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Mail className="h-4 w-4" />
              Destinataires
            </label>
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Saisissez les adresses de courriel, séparées par des virgules"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Séparez les différentes adresses de courriel par des virgules.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4" />
              Format du rapport
            </label>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full"
            >
              <option value="pdf">PDF (rapport professionnel)</option>
              <option value="excel">Excel (export de données)</option>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Le rapport PDF comprend les graphiques et les analyses ; le fichier Excel contient les données détaillées.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Récapitulatif de la planification</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Rapport :</span> {reportType}</p>
              <p><span className="font-medium">Fréquence :</span> {FREQUENCY_LABELS[frequency] || frequency}</p>
              {frequency === 'weekly' && <p><span className="font-medium">Jour :</span> {WEEKDAY_LABELS[parseInt(weekday)]}</p>}
              {frequency === 'monthly' && <p><span className="font-medium">Jour :</span> {day} du mois</p>}
              <p><span className="font-medium">Heure :</span> {time}</p>
              <p><span className="font-medium">Format :</span> {format.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSchedule}
            className="flex-1 bg-primary-600 hover:bg-primary-700"
            disabled={!recipients.trim() || saving}
          >
            Planifier le rapport
          </Button>
        </div>
      </div>
    </>
  );
}
