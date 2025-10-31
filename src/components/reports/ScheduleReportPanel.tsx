import { X, Calendar, Clock, Mail, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';

interface ScheduleReportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
}

export function ScheduleReportPanel({ isOpen, onClose, reportType }: ScheduleReportPanelProps) {
  const [frequency, setFrequency] = useState('weekly');
  const [recipients, setRecipients] = useState('');
  const [day, setDay] = useState('monday');
  const [time, setTime] = useState('09:00');

  if (!isOpen) return null;

  const handleSchedule = () => {
    console.log('Scheduling report:', { reportType, frequency, recipients, day, time });
    onClose();
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
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full"
              >
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
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
                defaultValue="1"
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Report Format
                </p>
                <p className="text-xs text-blue-700">
                  Reports will be generated as PDF documents with professional formatting,
                  charts, and recommendations.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Schedule Summary</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Report:</span> {reportType}</p>
              <p><span className="font-medium">Frequency:</span> {frequency.charAt(0).toUpperCase() + frequency.slice(1)}</p>
              {frequency === 'weekly' && <p><span className="font-medium">Day:</span> {day.charAt(0).toUpperCase() + day.slice(1)}</p>}
              <p><span className="font-medium">Time:</span> {time}</p>
              <p><span className="font-medium">Format:</span> PDF</p>
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
            disabled={!recipients.trim()}
          >
            Schedule Report
          </Button>
        </div>
      </div>
    </>
  );
}
