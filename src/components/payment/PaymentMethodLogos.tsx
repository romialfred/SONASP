import React from 'react';

export const OrangeMoneyLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#FF6600" rx="10"/>
    <circle cx="50" cy="35" r="15" fill="white"/>
    <text x="50" y="70" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">
      Orange
    </text>
    <text x="50" y="85" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">
      Money
    </text>
  </svg>
);

export const MoovMoneyLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#0066CC" rx="10"/>
    <circle cx="50" cy="35" r="12" fill="white"/>
    <circle cx="50" cy="35" r="8" fill="#0066CC"/>
    <text x="50" y="70" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="bold" fill="white" textAnchor="middle">
      moov
    </text>
    <text x="50" y="85" fontFamily="Arial, sans-serif" fontSize="9" fill="white" textAnchor="middle">
      money
    </text>
  </svg>
);

export const WaveLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#E91E63', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#9C27B0', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#waveGradient)" rx="10"/>
    <path d="M 20 50 Q 30 35, 40 50 T 60 50 T 80 50" stroke="white" strokeWidth="4" fill="none"/>
    <text x="50" y="80" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="bold" fill="white" textAnchor="middle">
      Wave
    </text>
  </svg>
);

export const MobileMoneyLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mobileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#7C4DFF', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#536DFE', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#mobileGradient)" rx="10"/>
    <rect x="35" y="25" width="30" height="45" rx="3" fill="white"/>
    <rect x="37" y="28" width="26" height="35" fill="#7C4DFF"/>
    <circle cx="50" cy="67" r="2" fill="#7C4DFF"/>
    <text x="50" y="90" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">
      Mobile Money
    </text>
  </svg>
);

export const BankTransferLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bankGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#1565C0', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#0D47A1', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#bankGradient)" rx="10"/>
    <polygon points="50,25 20,45 80,45" fill="white"/>
    <rect x="25" y="45" width="10" height="25" fill="white"/>
    <rect x="45" y="45" width="10" height="25" fill="white"/>
    <rect x="65" y="45" width="10" height="25" fill="white"/>
    <rect x="20" y="70" width="60" height="5" fill="white"/>
    <text x="50" y="90" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="bold" fill="white" textAnchor="middle">
      Virement
    </text>
  </svg>
);

export const CashLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#2E7D32', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#1B5E20', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#cashGradient)" rx="10"/>
    <rect x="20" y="35" width="60" height="30" rx="3" fill="white" opacity="0.9"/>
    <circle cx="50" cy="50" r="8" fill="#2E7D32"/>
    <text x="50" y="53" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">
      F
    </text>
    <text x="50" y="85" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">
      Espèces
    </text>
  </svg>
);

export const ChequeLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="chequeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#546E7A', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#37474F', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#chequeGradient)" rx="10"/>
    <rect x="15" y="30" width="70" height="40" rx="2" fill="white"/>
    <line x1="20" y1="45" x2="50" y2="45" stroke="#546E7A" strokeWidth="2"/>
    <line x1="20" y1="55" x2="60" y2="55" stroke="#546E7A" strokeWidth="2"/>
    <line x1="20" y1="65" x2="45" y2="65" stroke="#546E7A" strokeWidth="2"/>
    <text x="50" y="90" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">
      Chèque
    </text>
  </svg>
);
