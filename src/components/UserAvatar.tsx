import React, { useState } from 'react';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  className?: string;
  textClassName?: string;
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function getInitials(name: string | undefined): string {
  const words = (name || 'Traveler').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0]?.[0] || 'T').toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  className = 'h-10 w-10',
  textClassName = 'text-sm',
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (isHttpUrl(avatarUrl) && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `${name} avatar` : 'Traveler avatar'}
        className={`${className} rounded-full object-cover`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className={`${className} rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold ${textClassName}`}>
      {getInitials(name)}
    </div>
  );
};