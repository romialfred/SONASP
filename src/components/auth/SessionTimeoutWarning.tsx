import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Clock, AlertTriangle } from 'lucide-react';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [timeLeft, setTimeLeft] = useState(remainingSeconds);

  useEffect(() => {
    if (!isOpen) return;

    setTimeLeft(remainingSeconds);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, remainingSeconds]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="">
      <div className="relative overflow-hidden rounded-lg">
        {/* Animated Background - Ocean, Gold, Stars */}
        <div className="absolute inset-0 -z-10">
          {/* Stars Layer */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-blue-950 to-blue-900">
            {[...Array(50)].map((_, i) => (
              <div
                key={`star-${i}`}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `twinkle ${2 + Math.random() * 2}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                }}
              />
            ))}
          </div>

          {/* Ocean Waves - Bottom Layer */}
          <div className="absolute bottom-0 left-0 right-0 h-64">
            <svg
              className="absolute bottom-0 w-full h-full"
              viewBox="0 0 1200 300"
              preserveAspectRatio="none"
            >
              <path
                d="M0,100 C300,150 600,50 900,100 L900,300 L0,300 Z"
                fill="rgba(30, 58, 138, 0.6)"
                style={{ animation: 'wave-slow 8s ease-in-out infinite' }}
              />
              <path
                d="M0,150 C400,180 700,120 1200,150 L1200,300 L0,300 Z"
                fill="rgba(37, 99, 235, 0.5)"
                style={{ animation: 'wave-medium 6s ease-in-out infinite' }}
              />
              <path
                d="M0,180 C350,220 750,160 1200,200 L1200,300 L0,300 Z"
                fill="rgba(59, 130, 246, 0.4)"
                style={{ animation: 'wave-fast 4s ease-in-out infinite' }}
              />
            </svg>
          </div>

          {/* Gold Shimmer Effect - Middle Layer */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-transparent via-amber-500/10 to-transparent"
            style={{ animation: 'shimmer 3s linear infinite' }}
          />

          {/* Gold Particles Floating */}
          {[...Array(20)].map((_, i) => (
            <div
              key={`gold-${i}`}
              className="absolute w-2 h-2 bg-amber-400 rounded-full opacity-60"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: `${Math.random() * 100}%`,
                animation: `float ${4 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 p-8 text-center space-y-6">
          {/* Warning Icon with Pulse */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-50" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-6 rounded-full shadow-2xl">
                <AlertTriangle className="w-16 h-16 text-white" style={{ animation: 'bounce 1s infinite' }} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2
              className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 bg-clip-text text-transparent"
              style={{
                backgroundSize: '200% auto',
                animation: 'gradient 3s linear infinite'
              }}
            >
              Session Timeout Warning
            </h2>
            <p className="text-blue-100 text-lg">
              Your session will expire soon due to inactivity
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Clock className="w-8 h-8 text-amber-300" style={{ animation: 'spin-slow 3s linear infinite' }} />
              <div className="text-6xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                {formatTime(timeLeft)}
              </div>
            </div>
            <p className="text-blue-200 text-sm">
              Time remaining before automatic logout
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-blue-900/50 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 transition-all duration-1000 ease-linear relative overflow-hidden"
              style={{ width: `${(timeLeft / 30) * 100}%` }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{ animation: 'shimmer-fast 2s linear infinite' }}
              />
            </div>
          </div>

          {/* Action Message */}
          <div className="bg-blue-900/40 backdrop-blur-sm border border-blue-400/30 rounded-lg p-4">
            <p className="text-blue-100 text-sm leading-relaxed">
              To continue your session, click <strong className="text-amber-300">"Continue Working"</strong> below.
              Otherwise, you will be automatically logged out for security purposes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center pt-4">
            <Button
              onClick={onExtend}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <Clock className="w-5 h-5 mr-2" />
              Continue Working
            </Button>

            <Button
              onClick={onLogout}
              variant="secondary"
              size="lg"
              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              Logout Now
            </Button>
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-blue-400/20">
            <p className="text-blue-300/80 text-xs">
              Session timeout is set to <strong>1 minute</strong> of inactivity for security
            </p>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }

        @keyframes wave-slow {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-25%) translateY(-10px); }
        }

        @keyframes wave-medium {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-15%) translateY(-5px); }
        }

        @keyframes wave-fast {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-10%) translateY(-8px); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(45deg); }
          100% { transform: translateX(200%) rotate(45deg); }
        }

        @keyframes shimmer-fast {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.6;
          }
          25% {
            transform: translateY(-20px) translateX(10px);
            opacity: 1;
          }
          50% {
            transform: translateY(-40px) translateX(-10px);
            opacity: 0.8;
          }
          75% {
            transform: translateY(-20px) translateX(5px);
            opacity: 0.9;
          }
        }

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </Modal>
  );
}
