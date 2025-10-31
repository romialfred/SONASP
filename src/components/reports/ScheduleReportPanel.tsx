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
      alert('Failed to schedule report. Please try again.');
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
            <h2 className="text-xl font-bold text-gray-900">Schedule Report</h2>
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
              Frequency
            </label>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Day of Week
              </label>
              <Select
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                className="w-full"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </Select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Day of Month
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
              Time
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
              Recipients
            </label>
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Enter email addresses (comma separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple email addresses with commas
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4" />
              Report Format
            </label>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full"
            >
              <option value="pdf">PDF (Professional Report)</option>
              <option value="excel">Excel (Data Export)</option>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              PDF reports include charts and insights, Excel provides raw data
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Schedule Summary</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Report:</span> {reportType}</p>
              <p><span className="font-medium">Frequency:</span> {frequency.charAt(0).toUpperCase() + frequency.slice(1)}</p>
              {frequency === 'weekly' && <p><span className="font-medium">Day:</span> {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(weekday)]}</p>}
              {frequency === 'monthly' && <p><span className="font-medium">Day:</span> {day} of the month</p>}
              <p><span className="font-medium">Time:</span> {time}</p>
              <p><span className="font-medium">Format:</span> {format.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            className="flex-1 bg-primary-600 hover:bg-primary-700"
            disabled={!recipients.trim() || saving}
          >
            Schedule Report
          </Button>
        </div>
      </div>
    </>
  );
}
