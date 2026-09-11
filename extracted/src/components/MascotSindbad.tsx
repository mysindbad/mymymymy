import React from 'react';
import { AIIcon } from './AIIcon';

interface MascotSindbadProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  mood?: 'happy' | 'thinking' | 'navigating' | 'celebrating' | 'warning';
  showBadge?: boolean;
}

export const MascotSindbad: React.FC<MascotSindbadProps> = ({
  size = 'md',
  mood = 'happy',
  showBadge = false,
}) => {
  const pixelMap = {
    sm: 26,
    md: 36,
    lg: 46,
    xl: 64,
  };

  const moodBadge = {
    happy: '✨',
    thinking: '💭',
    navigating: '🧭',
    celebrating: '🎉',
    warning: '⚠️',
  };

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <div className="flex items-center justify-center transition-transform hover:scale-105">
        <AIIcon size={pixelMap[size]} variant="badge" />
      </div>

      {showBadge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 border-2 border-white rounded-full flex items-center justify-center shadow-xs text-[9px]">
          {moodBadge[mood] || '✨'}
        </span>
      )}
    </div>
  );
};
