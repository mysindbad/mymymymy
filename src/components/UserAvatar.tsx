import { UserRound } from 'lucide-react';
import React, { useState } from 'react';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  className?: string;
  textClassName?: string;
  /** `onDark` keeps initials legible above photo or night surfaces. */
  tone?: 'surface' | 'onDark';
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/** No name means no identity to show: a neutral glyph beats a stray initial. */
function getInitials(name: string | undefined): string | null {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0]).toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  className = 'h-10 w-10',
  textClassName = 'text-sm',
  tone = 'surface',
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (isHttpUrl(avatarUrl) && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `${name} avatar` : 'Traveler avatar'}
        loading="lazy"
        decoding="async"
        className={`${className} shrink-0 rounded-full bg-surface-sunken object-cover`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        tone === 'onDark' ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand-accent'
      } font-bold ${textClassName}`}
    >
      {getInitials(name) ?? <UserRound className="h-1/2 w-1/2" strokeWidth={2.1} aria-hidden="true" />}
    </div>
  );
};
