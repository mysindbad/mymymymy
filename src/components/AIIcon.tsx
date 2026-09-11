import React from 'react';

interface AIIconProps {
  className?: string;
  size?: number;
  variant?: 'badge' | 'glyph' | 'minimal';
  active?: boolean;
}

export const AIIcon: React.FC<AIIconProps> = ({
  className = 'w-6 h-6',
  size = 24,
  variant = 'badge',
  active = false,
}) => {
  if (variant === 'glyph') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient id="ai_glyph_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="60%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="ai_glyph_sparkle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Letter A */}
        <path
          d="M3.5 19L8 6.5L12.5 19"
          stroke={active ? 'url(#ai_glyph_grad)' : 'currentColor'}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.5 14H10.5"
          stroke={active ? 'url(#ai_glyph_grad)' : 'currentColor'}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Letter I */}
        <path
          d="M16 6.5V19"
          stroke={active ? 'url(#ai_glyph_grad)' : 'currentColor'}
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* AI Neural Sparkle Star */}
        <path
          d="M20 2C20 4.2 21.5 5.5 23.5 5.5C21.5 5.5 20 6.8 20 9C20 6.8 18.5 5.5 16.5 5.5C18.5 5.5 20 4.2 20 2Z"
          fill="url(#ai_glyph_sparkle)"
        />
      </svg>
    );
  }

  // Default: 'badge' - Luxury, ultra-crisp rounded squircle matching Sindbad brand identity
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ai_brand_bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="45%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="ai_brand_spark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="ai_soft_glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1d4ed8" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Main Squircle Badge with Sindbad Sapphire & Azure Gradient */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8.5"
        fill="url(#ai_brand_bg)"
        filter="url(#ai_soft_glow)"
      />
      {/* Delicate Inner Highlight Border */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.3"
      />

      {/* Modern High-Precision 'A' */}
      <path
        d="M7 22L11.5 9.5L16 22"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.8 17.5H14.2"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
      />

      {/* Modern High-Precision 'I' */}
      <path
        d="M19.5 9.5V22"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Modern 4-point AI Star / Sparkle in Top-Right Corner */}
      <path
        d="M25.5 3C25.5 5.5 27 7 29.5 7C27 7 25.5 8.5 25.5 11C25.5 8.5 24 7 21.5 7C24 7 25.5 5.5 25.5 3Z"
        fill="url(#ai_brand_spark)"
      />
      <circle cx="25.5" cy="7" r="0.75" fill="white" />
    </svg>
  );
};
