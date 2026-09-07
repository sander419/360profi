import React, { useState } from 'react';
import {
  Search,
  X,
  Radio,
  Signal,
  CheckCircle2,
  Clock,
  WifiOff,
  Users,
  RefreshCw,
  Download,
  UserPlus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TeamMemberCard } from '../team/TeamMemberCard';
import { MemberOnlineStatus } from '../../types';
import { exportTeamToCsv } from '../../utils/exportCsv';

export const TeamView: React.FC = () => {
  const {
    state,
    flashId,
    openProject,
    toggleMemberOnlineStatus,
    pingTeamTelemetry,
    setIsNewTeamModalOpen
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | MemberOnlineStatus>('all');
  const [isPinging, setIsPinging] = useState(false);

  const handlePing = () => {
    setIsPinging(true);
    pingTeamTelemetry();
    setTimeout(() => setIsPinging(false), 800);
  };

  // Calculations for KPI counters
  const totalStaff = state.team.length;
  const onlineCount = state.team.filter(
    (u) => (u.onlineStatus || 'online') === 'online'
  ).length;
  const busyCount = state.team.filter(
    (u) => u.onlineStatus === 'busy'
  ).length;
  const offlineCount = state.team.filter(
    (u) => u.onlineStatus === 'offline'
  ).length;

  // Filtered members list
  const filteredTeam = state.team.filter((user) => {
    const userStatus = user.onlineStatus || 'online';

    // Availability Filter
    if (availabilityFilter !== 'all' && userStatus !== availabilityFilter) {
      return false;
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = user.name.toLowerCase().includes(q);
      const roleMatch = user.role.toLowerCase().includes(q);
      const locMatch = (user.location || '').toLowerCase().includes(q);
      const compMatch = Object.keys(user.comps).some((k) =>
        k.toLowerCase().includes(q)
      );

      if (!nameMatch && !roleMatch && !locMatch && !compMatch) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header with Title and Telemetry Ping Action */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
              Команда и доступность
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span>{onlineCount + busyCount} на связи</span>
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-1 flex items-center gap-1.5">
            <span>Онлайн-статусы персонала, радиочастоты, локации и загрузка на объектах</span>
          </p>
        </div>

        {/* Actions: Telemetry, Export, Add Member */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => exportTeamToCsv(state.team)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27272a] bg-[#18181b] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] hover:bg-[#27272a]/50 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Экспорт списка команды и статусов в CSV (Excel)"
          >
            <Download className="w-3.5 h-3.5 text-[#ec4899]" />
            <span>Экспорт CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-[#3f3f46] text-[#fafafa] transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Проверить статус связи и пинг всех радиостанций"
          >
            <Radio className={`w-3.5 h-3.5 text-[#10b981] ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Опрос...' : 'Радиоперекличка'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewTeamModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#ec4899] hover:bg-[#ec4899]/90 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-[#ec4899]/20 active:scale-95"
            title="Зачислить нового специалиста в штат"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Специалист</span>
          </button>
        </div>
      </div>

      {/* Real-time Availability Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Staff */}
        <button
          type="button"
          onClick={() => setAvailabilityFilter('all')}
          className={`bg-[#18181b] border rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer ${
            availabilityFilter === 'all'
              ? 'border-[#6366f1] ring-1 ring-[#6366f1]/50 bg-[#6366f1]/5'
              : 'border-[#27272a] hover:border-[#3f3f46]'
          }`}
        >
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Всего в штате</div>
            <div className="text-xl font-bold text-[#fafafa] font-mono mt-0.5">
              {totalStaff}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
            <Users className="w-4 h-4" />
          </div>
        </button>

        {/* Online / Available */}
        <button
          type="button"
          onClick={() => setAvailabilityFilter('online')}
          className={`bg-[#18181b] border rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer ${
            availabilityFilter === 'online'
              ? 'border-[#10b981] ring-1 ring-[#10b981]/50 bg-[#10b981]/5'
              : 'border-[#27272a] hover:border-[#3f3f46]'
          }`}
        >
          <div>
            <div className="text-[11px] text-[#10b981] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
              <span>В сети (Онлайн)</span>
            </div>
            <div className="text-xl font-bold text-[#10b981] font-mono mt-0.5">
              {onlineCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
            <Signal className="w-4 h-4" />
          </div>
        </button>

        {/* Busy / On Site */}
        <button
          type="button"
          onClick={() => setAvailabilityFilter('busy')}
          className={`bg-[#18181b] border rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer ${
            availabilityFilter === 'busy'
              ? 'border-[#f59e0b] ring-1 ring-[#f59e0b]/50 bg-[#f59e0b]/5'
              : 'border-[#27272a] hover:border-[#3f3f46]'
          }`}
        >
          <div>
            <div className="text-[11px] text-[#f59e0b] font-medium">На площадке / Занят</div>
            <div className="text-xl font-bold text-[#f59e0b] font-mono mt-0.5">
              {busyCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b]">
            <Clock className="w-4 h-4" />
          </div>
        </button>

        {/* Offline */}
        <button
          type="button"
          onClick={() => setAvailabilityFilter('offline')}
          className={`bg-[#18181b] border rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer ${
            availabilityFilter === 'offline'
              ? 'border-zinc-500 ring-1 ring-zinc-500/50 bg-zinc-800/20'
              : 'border-[#27272a] hover:border-[#3f3f46]'
          }`}
        >
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Офлайн / Не на смене</div>
            <div className="text-xl font-bold text-[#71717a] font-mono mt-0.5">
              {offlineCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-[#71717a]">
            <WifiOff className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center gap-3 flex-wrap bg-[#18181b]/70 border border-[#27272a] rounded-xl p-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени, роли, локации или навыкам..."
            className="w-full pl-9 pr-8 py-1.5 bg-[#09090b] border border-[#27272a] rounded-lg text-xs text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#6366f1]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#fafafa] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Availability Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setAvailabilityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              availabilityFilter === 'all'
                ? 'bg-[#6366f1] text-white shadow-xs'
                : 'border border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:text-[#fafafa]'
            }`}
          >
            Все ({totalStaff})
          </button>

          <button
            type="button"
            onClick={() => setAvailabilityFilter('online')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              availabilityFilter === 'online'
                ? 'bg-[#10b981] text-[#09090b] font-semibold shadow-xs'
                : 'border border-[#27272a] bg-[#09090b] text-[#10b981] hover:border-[#10b981]/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>В сети ({onlineCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setAvailabilityFilter('busy')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              availabilityFilter === 'busy'
                ? 'bg-[#f59e0b] text-[#09090b] font-semibold shadow-xs'
                : 'border border-[#27272a] bg-[#09090b] text-[#f59e0b] hover:border-[#f59e0b]/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>На площадке ({busyCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setAvailabilityFilter('offline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              availabilityFilter === 'offline'
                ? 'bg-zinc-700 text-white font-semibold shadow-xs'
                : 'border border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:border-zinc-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#71717a]" />
            <span>Офлайн ({offlineCount})</span>
          </button>
        </div>
      </div>

      {/* Grid of Team Cards */}
      {filteredTeam.length === 0 ? (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-12 text-center space-y-3">
          <WifiOff className="w-8 h-8 text-[#71717a] mx-auto opacity-70" />
          <div className="text-sm font-medium text-[#fafafa]">
            Сотрудников с выбранным статусом не найдено
          </div>
          <p className="text-xs text-[#71717a] max-w-sm mx-auto">
            Попробуйте изменить параметры поиска или сбросить фильтр доступности.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setAvailabilityFilter('all');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] transition-colors cursor-pointer mt-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Сбросить фильтры</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeam.map((user) => {
            const myProjects = state.projects.filter(
              (p) => p.status === 'active' && p.teamIds.includes(user.id)
            );
            const isFlashed = flashId === `team-${user.id}`;

            return (
              <TeamMemberCard
                key={user.id}
                user={user}
                activeProjects={myProjects}
                isFlashed={isFlashed}
                onOpenProject={openProject}
                onStatusChange={toggleMemberOnlineStatus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

