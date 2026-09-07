import React from 'react';
import {
  MapPin,
  Clock,
  Radio,
  Smartphone,
  Laptop,
  PhoneCall,
  Activity,
  Layers
} from 'lucide-react';
import { TeamMember, MemberOnlineStatus, Project } from '../../types';
import { Avatar } from '../common/Avatar';
import { AvailabilityBadge } from './AvailabilityBadge';
import { loadColor } from '../../data/seedData';
import { useApp } from '../../context/AppContext';

interface TeamMemberCardProps {
  user: TeamMember;
  activeProjects: Project[];
  isFlashed: boolean;
  onOpenProject: (id: string) => void;
  onStatusChange: (id: string, status: MemberOnlineStatus) => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  user,
  activeProjects,
  isFlashed,
  onOpenProject,
  onStatusChange
}) => {
  const { addToast, addActivity } = useApp();

  const getCompetencyBadge = (level: string) => {
    switch (level) {
      case 'Senior':
        return 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25';
      case 'Middle':
        return 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/25';
      case 'не допущен':
        return 'bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25';
      default:
        return 'bg-[#09090b] text-[#a1a1aa] border border-[#27272a]';
    }
  };

  const getAssignmentBadge = (status: string, load: number) => {
    if (load > 85) {
      return 'bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25';
    }
    if (status === 'Свободен') {
      return 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25';
    }
    if (status === 'Обучение') {
      return 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/25';
    }
    return 'bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/25';
  };

  const handleRadioCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    const channel = user.device === 'radio' ? 'радиоканалу DMR (К1)' : 'мобильной связи';
    addToast(`📡 Вызов отправлен: ${user.name} по ${channel}`, 'ok');

    addActivity({
      type: 'team',
      title: 'Радиовызов сотрудника',
      detail: `Диспетчер запросил связь с ${user.name} (${user.role})`,
      actor: 'Диспетчер (вы)',
      actorRole: 'Штаб связи',
      badgeType: 'ok',
      target: { type: 'team', id: user.id }
    });
  };

  const currentOnlineStatus = user.onlineStatus || 'online';

  return (
    <div
      id={`team-${user.id}`}
      className={`bg-[#18181b] border rounded-2xl p-4.5 transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex flex-col justify-between ${
        currentOnlineStatus === 'online'
          ? 'border-[#27272a] hover:border-[#3f3f46]'
          : currentOnlineStatus === 'busy'
          ? 'border-[#f59e0b]/30 hover:border-[#f59e0b]/50'
          : 'border-[#27272a]/70 opacity-80 hover:opacity-100 hover:border-[#3f3f46]'
      } ${isFlashed ? 'animate-flash' : ''}`}
    >
      <div>
        {/* Header: Avatar with Status Dot, Name, Role, Availability Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with dynamic real-time status indicator */}
            <Avatar
              name={user.name}
              size="lg"
              onlineStatus={currentOnlineStatus}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[14px] text-[#fafafa] truncate">
                  {user.name}
                </span>
              </div>
              <div className="text-xs text-[#71717a] truncate mt-0.5">
                {user.role}
              </div>
            </div>
          </div>

          {/* Interactive Availability Indicator Pill */}
          <AvailabilityBadge
            member={user}
            onStatusChange={(status) => onStatusChange(user.id, status)}
          />
        </div>

        {/* Real-time Telemetry Bar: Location, Device & Last Active */}
        <div className="mt-3 py-2 px-2.5 rounded-xl bg-[#09090b]/80 border border-[#27272a] flex items-center justify-between gap-2 text-[11px] flex-wrap">
          <div className="flex items-center gap-1.5 text-[#a1a1aa] min-w-0 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#6366f1] flex-none" />
            <span className="truncate">{user.location || 'Штаб / База'}</span>
          </div>

          <div className="flex items-center gap-2 flex-none">
            {/* Last active info */}
            <span className="text-[#71717a] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#71717a]" />
              <span className="truncate max-w-[130px]">{user.lastSeen || 'В сети'}</span>
            </span>

            {/* Quick Ping Button */}
            {currentOnlineStatus !== 'offline' && (
              <button
                type="button"
                onClick={handleRadioCall}
                className="p-1 rounded-md text-[#71717a] hover:text-[#10b981] hover:bg-white/5 transition-colors cursor-pointer"
                title="Отправить радиовызов / пинг"
              >
                <Radio className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Assignment & Project Status Pill */}
        <div className="flex items-center justify-between gap-2 mt-3 mb-1">
          <span className="text-[11px] text-[#71717a] flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#71717a]" />
            <span>Назначение:</span>
          </span>
          <span
            className={`text-[10.5px] font-medium px-2.5 py-0.5 rounded-full flex-none ${getAssignmentBadge(
              user.status,
              user.load
            )}`}
          >
            {user.status}
          </span>
        </div>

        {/* Competencies Matrix */}
        <div className="flex items-center gap-1.5 flex-wrap my-3">
          {Object.entries(user.comps).map(([cat, level]) => (
            <span
              key={cat}
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${getCompetencyBadge(
                level as string
              )}`}
            >
              {cat} · {level as string}
            </span>
          ))}
        </div>
      </div>

      <div>
        {/* Workload Progress */}
        <div className="flex items-center gap-3 pt-2">
          <span className="text-[10px] tracking-wider uppercase font-medium text-[#71717a]">
            Загрузка
          </span>
          <div className="flex-1 h-2 rounded-full bg-[#27272a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${user.load}%`,
                backgroundColor: loadColor(user.load)
              }}
            />
          </div>
          <span className="font-mono text-xs font-semibold text-[#a1a1aa] w-9 text-right">
            {user.load}%
          </span>
        </div>

        {/* Active Projects Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-3 border-t border-[#27272a]">
          {activeProjects.length === 0 ? (
            <span className="text-[11px] text-[#71717a]">
              нет активных проектов
            </span>
          ) : (
            activeProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenProject(p.id)}
                className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa] hover:border-[#6366f1] hover:text-[#fafafa] transition-colors cursor-pointer"
                title={`${p.id} · ${p.title}`}
              >
                {p.id}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
