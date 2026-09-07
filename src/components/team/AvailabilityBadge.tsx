import React, { useState } from 'react';
import {
  Radio,
  Smartphone,
  Laptop,
  MapPin,
  Clock,
  ChevronDown,
  Check,
  Signal
} from 'lucide-react';
import { MemberOnlineStatus, TeamMember } from '../../types';

interface AvailabilityBadgeProps {
  member: TeamMember;
  onStatusChange?: (status: MemberOnlineStatus) => void;
  interactive?: boolean;
}

export const AVAILABILITY_CONFIG: Record<
  MemberOnlineStatus,
  {
    label: string;
    shortLabel: string;
    dotColor: string;
    badgeStyle: string;
    description: string;
  }
> = {
  online: {
    label: 'В сети (Онлайн)',
    shortLabel: 'В сети',
    dotColor: 'bg-[#10b981]',
    badgeStyle: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 hover:border-[#10b981]/50',
    description: 'На связи и готов к координации'
  },
  busy: {
    label: 'На площадке / Занят',
    shortLabel: 'На площадке',
    dotColor: 'bg-[#f59e0b]',
    badgeStyle: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 hover:border-[#f59e0b]/50',
    description: 'Занят монтажом / на мероприятии'
  },
  offline: {
    label: 'Не в сети (Офлайн)',
    shortLabel: 'Офлайн',
    dotColor: 'bg-[#71717a]',
    badgeStyle: 'bg-zinc-800/80 text-[#a1a1aa] border-zinc-700/60 hover:border-zinc-600',
    description: 'Смена не начата или завершена'
  }
};

export const AvailabilityBadge: React.FC<AvailabilityBadgeProps> = ({
  member,
  onStatusChange,
  interactive = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentStatus = member.onlineStatus || 'online';
  const config = AVAILABILITY_CONFIG[currentStatus];

  const getDeviceIcon = (device?: 'radio' | 'mobile' | 'desktop') => {
    switch (device) {
      case 'radio':
        return <Radio className="w-3 h-3 text-[#10b981]" title="Связь через цифровую рацию (DMR/Tetra)" />;
      case 'desktop':
        return <Laptop className="w-3 h-3 text-[#6366f1]" title="Рабочая станция / Диспетчерская" />;
      case 'mobile':
      default:
        return <Smartphone className="w-3 h-3 text-[#818cf8]" title="Мобильное приложение" />;
    }
  };

  const handleSelectStatus = (status: MemberOnlineStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onStatusChange) {
      onStatusChange(status);
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* Badge Button */}
      <button
        type="button"
        disabled={!interactive}
        onClick={(e) => {
          e.stopPropagation();
          if (interactive) setIsOpen(!isOpen)}
        }
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
          config.badgeStyle
        } ${interactive ? 'cursor-pointer hover:shadow-xs' : 'cursor-default'}`}
        title={interactive ? 'Нажмите, чтобы изменить статус связи' : config.description}
      >
        {/* Pulsing indicator dot */}
        <span className="relative flex h-2 w-2">
          {currentStatus === 'online' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
        </span>

        <span className="truncate">{config.shortLabel}</span>

        {/* Device Icon */}
        <span className="opacity-80 flex items-center">
          {getDeviceIcon(member.device)}
        </span>

        {interactive && (
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu for Changing Status */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div className="absolute left-0 mt-1.5 w-52 rounded-xl bg-[#18181b] border border-[#27272a] shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1 text-[10px] font-semibold text-[#71717a] uppercase tracking-wider border-b border-[#27272a]/60 flex items-center gap-1">
              <Signal className="w-3 h-3 text-[#6366f1]" />
              <span>Статус доступности</span>
            </div>

            {(['online', 'busy', 'offline'] as MemberOnlineStatus[]).map((statusKey) => {
              const itemConfig = AVAILABILITY_CONFIG[statusKey];
              const isSelected = currentStatus === statusKey;

              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={(e) => handleSelectStatus(statusKey, e)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer ${
                    isSelected ? 'text-[#fafafa] font-semibold bg-white/[0.03]' : 'text-[#a1a1aa]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-none ${itemConfig.dotColor}`} />
                    <div>
                      <div className="text-[11.5px] leading-tight text-[#fafafa]">
                        {itemConfig.label}
                      </div>
                      <div className="text-[10px] text-[#71717a] leading-tight mt-0.5">
                        {itemConfig.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#10b981] flex-none ml-1.5 stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
