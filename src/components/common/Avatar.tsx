import React from 'react';
import { initials, avColor } from '../../data/seedData';
import { MemberOnlineStatus } from '../../types';

interface AvatarProps {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onlineStatus?: MemberOnlineStatus;
  showStatusDot?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  className = '',
  size = 'md',
  onlineStatus,
  showStatusDot = false
}) => {
  const bg = avColor(name);
  const sizeClasses = {
    sm: 'w-5 h-5 text-[9px]',
    md: 'w-7 h-7 text-[11px]',
    lg: 'w-10 h-10 text-[13px]',
    xl: 'w-12 h-12 text-[15px]'
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5 bottom-0 right-0 ring-1 ring-[#18181b]',
    md: 'w-2 h-2 bottom-0 right-0 ring-1.5 ring-[#18181b]',
    lg: 'w-2.5 h-2.5 bottom-0 right-0 ring-2 ring-[#18181b]',
    xl: 'w-3 h-3 bottom-0.5 right-0.5 ring-2 ring-[#18181b]'
  };

  const statusColors: Record<MemberOnlineStatus, string> = {
    online: 'bg-[#10b981]',
    busy: 'bg-[#f59e0b]',
    offline: 'bg-[#71717a]'
  };

  const effectiveStatus = onlineStatus || (showStatusDot ? 'online' : undefined);

  return (
    <div className="relative inline-flex flex-none">
      <div
        className={`rounded-full flex items-center justify-center font-extrabold text-[#08101c] flex-none tracking-wider select-none ${sizeClasses[size]} ${className}`}
        style={{ backgroundColor: bg }}
        title={name}
      >
        {initials(name)}
      </div>

      {effectiveStatus && (
        <span
          className={`absolute rounded-full z-10 ${dotSizeClasses[size]} ${statusColors[effectiveStatus]}`}
          title={`Статус: ${
            effectiveStatus === 'online'
              ? 'В сети'
              : effectiveStatus === 'busy'
              ? 'На площадке / Занят'
              : 'Офлайн'
          }`}
        >
          {effectiveStatus === 'online' && (size === 'lg' || size === 'xl') && (
            <span className="absolute inset-0 rounded-full bg-[#10b981] animate-ping opacity-75 pointer-events-none" />
          )}
        </span>
      )}
    </div>
  );
};
