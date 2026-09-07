import React, { useState } from 'react';
import {
  Info,
  X,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PanelRight,
  Plus,
  Command,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CircularProgress } from '../common/CircularProgress';
import { Avatar } from '../common/Avatar';
import { fmtRu, daysLeft, pctColor, loadColor, IMG, D } from '../../data/seedData';
import { ActivityFeed } from '../ActivityFeed';

export const HubView: React.FC = () => {
  const [feedDisplayMode, setFeedDisplayMode] = useState<'card' | 'sidebar'>('card');
  const {
    state,
    dismissBanner,
    switchView,
    openProject,
    triggerFlash,
    getReadiness,
    isOverdue,
    toggleDocStatus,
    setIsModalOpen,
    setIsNewProjectModalOpen,
    setIsNewEquipmentModalOpen,
    setIsCommandPaletteOpen
  } = useApp();

  const activeProjects = state.projects.filter((p) => p.status === 'active');
  const soon7Projects = activeProjects.filter((p) => {
    const d = daysLeft(p.date);
    return d >= 0 && d <= 7;
  });

  const openTasks = state.tasks.filter((t) => t.status !== 'done');
  const overdueTasks = state.tasks.filter((t) => isOverdue(t));

  const inStockEq = state.equipment.filter((q) => q.status === 'stock').length;
  const inRepairEq = state.equipment.filter((q) => q.status === 'repair').length;
  const totalEq = state.equipment.length;

  const avgLoad = Math.round(
    state.team.reduce((acc, cur) => acc + cur.load, 0) / (state.team.length || 1)
  );
  const overloadedTeam = state.team.filter((u) => u.load > 85).length;

  const docAttention = state.docs.filter((d) => d.status !== 'ok');
  const docOverdue = docAttention.filter((d) => d.due && daysLeft(d.due) < 0).length;

  const minDaysToEvent = activeProjects.length
    ? Math.min(...activeProjects.map((p) => daysLeft(p.date)))
    : 0;

  const handleAlertClick = (alert: (typeof state.alerts)[0]) => {
    if (alert.go.type === 'project') {
      openProject(alert.go.id);
    } else if (alert.go.type === 'equipment') {
      switchView('equipment');
      setTimeout(() => {
        triggerFlash(`eq-${alert.go.id}`);
        const el = document.getElementById(`eq-${alert.go.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else if (alert.go.type === 'team') {
      switchView('team');
      setTimeout(() => {
        triggerFlash(`team-${alert.go.id}`);
        const el = document.getElementById(`team-${alert.go.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const sortedProjects = [...activeProjects].sort(
    (a, b) => daysLeft(a.date) - daysLeft(b.date)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome / MVP Banner */}
      {state.banner && (
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-gradient-to-r from-[#6366f1]/10 via-[#18181b] to-[#18181b] border border-[#6366f1]/25 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] flex-none">
            <Info className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[14px] text-[#fafafa]">
              MVP №1 — «Единый внутренний штаб 360PROFI»
            </h4>
            <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
              Операционное состояние продакшна в одном окне: готовность проектов по 5 осям, просроченные дедлайны, диагностика склада, загрузка специалистов и согласование документов. Кликайте по карточкам для подробностей.
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Скрыть баннер"
            aria-label="Скрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Header with Actions */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
            Штаб компании
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Сводка на сегодня · {fmtRu(D(0))}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Action Buttons */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6366f1] hover:bg-[#6366f1]/90 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-[#6366f1]/20 active:scale-95"
            title="Создать новую задачу (N)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Задача</span>
            <kbd className="text-[9px] font-mono bg-black/20 px-1 py-0.2 rounded ml-0.5">N</kbd>
          </button>

          <button
            type="button"
            onClick={() => setIsNewProjectModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-[#09090b] text-xs font-semibold transition-all cursor-pointer shadow-md shadow-[#38bdf8]/20 active:scale-95"
            title="Открыть новый проект (P)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Проект</span>
            <kbd className="text-[9px] font-mono bg-black/15 px-1 py-0.2 rounded ml-0.5">P</kbd>
          </button>

          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] hover:border-[#3f3f46] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Открыть меню команд (⌘K / Ctrl+K)"
          >
            <Command className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Команды</span>
            <kbd className="text-[9px] font-mono bg-[#27272a] px-1 py-0.2 rounded ml-0.5">⌘K</kbd>
          </button>

          {/* Feed layout toggle */}
          <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-xl p-1 text-xs">
            <button
              onClick={() => setFeedDisplayMode('card')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                feedDisplayMode === 'card'
                  ? 'bg-[#27272a] text-[#fafafa] shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              title="Отображать оперативную ленту как центральную секцию"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Лента в центре</span>
            </button>
            <button
              onClick={() => setFeedDisplayMode('sidebar')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                feedDisplayMode === 'sidebar'
                  ? 'bg-[#27272a] text-[#fafafa] shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              title="Закрепить оперативную ленту в боковой панели"
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span>Боковая панель</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 KPI Cards (Sleek Interface Stat Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1 */}
        <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-4 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
            <span className="w-2 h-2 rounded-full bg-[#6366f1]" />
            <span>Активные проекты</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#fafafa] mt-2">
            {activeProjects.length}
          </div>
          <div className="text-[11px] text-[#71717a] mt-1">
            ближайшее через{' '}
            <b className="text-[#f59e0b] font-medium">
              {minDaysToEvent === 0 ? 'сегодня' : `${minDaysToEvent} дн`}
            </b>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-4 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>В течение 7 дней</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#fafafa] mt-2">
            {soon7Projects.length}
          </div>
          <div className="text-[11px] text-[#71717a] mt-1 truncate">
            {soon7Projects.length
              ? soon7Projects.map((p) => p.id).join(', ')
              : 'мероприятий нет'}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-4 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
            <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
            <span>Открытые задачи</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#fafafa] mt-2">
            {openTasks.length}
          </div>
          <div className="text-[11px] text-[#71717a] mt-1">
            просрочено <b className="text-[#f43f5e] font-medium">{overdueTasks.length}</b>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-4 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>На складе</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#fafafa] mt-2">
            {inStockEq}
            <span className="text-sm font-normal text-[#71717a]">/{totalEq}</span>
          </div>
          <div className="text-[11px] text-[#71717a] mt-1">
            в ремонте <b className="text-[#f43f5e] font-medium">{inRepairEq}</b>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-4 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
            <span className="w-2 h-2 rounded-full bg-[#6366f1]" />
            <span>Средняя загрузка</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#fafafa] mt-2">
            {avgLoad}%
          </div>
          <div className="text-[11px] text-[#71717a] mt-1">
            перегружено (&gt;85%){' '}
            <b className={overloadedTeam > 0 ? 'text-[#f43f5e] font-medium' : 'text-[#10b981] font-medium'}>
              {overloadedTeam}
            </b>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl p-4 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>Документы</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#fafafa] mt-2">
            {docAttention.length}
          </div>
          <div className="text-[11px] text-[#71717a] mt-1">
            просрочено <b className="text-[#f43f5e] font-medium">{docOverdue}</b>
          </div>
        </div>
      </div>

      {/* Dynamic Content Layout: Card Flow vs. Docked Sidebar */}
      <div className={feedDisplayMode === 'sidebar' ? 'grid grid-cols-1 xl:grid-cols-12 gap-5 items-start' : 'space-y-6'}>
        <div className={feedDisplayMode === 'sidebar' ? 'xl:col-span-8 space-y-6' : 'space-y-6'}>
          {/* Row 1: Project Readiness + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Project Readiness (3 cols) */}
        <div className="lg:col-span-3 bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
            <div>
              <h3 className="font-semibold text-[14px] text-[#fafafa]">
                Готовность проектов
              </h3>
              <div className="text-[11px] text-[#71717a]">
                кликните строку для открытия карточки проекта
              </div>
            </div>
            <button
              onClick={() => switchView('projects')}
              className="flex items-center gap-1 text-xs text-[#6366f1] font-medium hover:underline px-2.5 py-1 rounded-lg hover:bg-[#6366f1]/10 transition-colors"
            >
              <span>Все проекты</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#27272a] flex-1">
            {sortedProjects.map((p) => {
              const r = getReadiness(p);
              const dl = daysLeft(p.date);
              const isUrgent = dl <= 1;
              const isSoon = dl > 1 && dl <= 4;

              return (
                <div
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <CircularProgress value={r} size={48} strokeWidth={4.5} />

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[13.5px] text-[#fafafa] group-hover:text-[#6366f1] transition-colors truncate">
                      {p.title}
                    </div>
                    <div className="text-[11.5px] text-[#71717a] truncate">
                      {p.client} · {p.venue}
                    </div>

                    {/* 5 mini bars */}
                    <div className="flex items-center gap-1 mt-2">
                      {(Object.values(p.breakdown) as number[]).map((v, vi) => (
                        <div
                          key={vi}
                          className="h-1 flex-1 rounded-full bg-[#27272a] overflow-hidden"
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${v}%`,
                              backgroundColor: pctColor(v)
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`font-mono text-xs px-2.5 py-1 rounded-lg flex-none border ${
                      isUrgent
                        ? 'bg-[#f43f5e]/10 text-[#f43f5e] border-[#f43f5e]/25 font-medium'
                        : isSoon
                        ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/25 font-medium'
                        : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a]'
                    }`}
                  >
                    {dl === 0 ? 'сегодня' : `через ${dl} дн`} · {fmtRu(p.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline (2 cols) */}
        <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
            <h3 className="font-semibold text-[14px] text-[#fafafa]">
              Ближайшие мероприятия
            </h3>
            <span className="text-[11px] text-[#71717a]">14 дней</span>
          </div>

          <div className="divide-y divide-[#27272a] flex-1">
            {activeProjects
              .filter((p) => daysLeft(p.date) <= 14)
              .sort((a, b) => daysLeft(a.date) - daysLeft(b.date))
              .map((p) => {
                const d = new Date(p.date + 'T00:00:00');
                const readiness = getReadiness(p);
                return (
                  <div
                    key={p.id}
                    onClick={() => openProject(p.id)}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <div className="flex-none w-12 text-center bg-[#09090b] border border-[#27272a] rounded-xl py-1.5 px-1">
                      <div className="font-mono text-base font-bold text-[#fafafa] leading-none">
                        {d.getDate()}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-[#71717a] mt-0.5">
                        {fmtRu(p.date).split(' ')[1]}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[13px] text-[#fafafa] group-hover:text-[#6366f1] transition-colors truncate">
                        {p.title}
                      </div>
                      <div className="text-[11.5px] text-[#71717a] truncate">
                        {p.venue} · готовность {readiness}%
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Activity Feed in Card Mode */}
      {feedDisplayMode === 'card' && (
        <ActivityFeed variant="card" maxHeight="max-h-[460px]" />
      )}

      {/* Row 2: Alerts + Workload + Docs (3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Alerts */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
            <h3 className="font-semibold text-[14px] text-[#fafafa]">
              Проблемные места
            </h3>
            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25">
              {state.alerts.filter((a) => a.sev === 'crit').length} крит
            </span>
          </div>

          <div className="divide-y divide-[#27272a] flex-1">
            {state.alerts.map((a, i) => {
              const icons = {
                crit: <AlertCircle className="w-4 h-4 text-[#f43f5e]" />,
                warn: <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />,
                info: <Info className="w-4 h-4 text-[#8b5cf6]" />
              };
              const bgColors = {
                crit: 'bg-[#f43f5e]/15 border-[#f43f5e]/20',
                warn: 'bg-[#f59e0b]/15 border-[#f59e0b]/20',
                info: 'bg-[#8b5cf6]/15 border-[#8b5cf6]/20'
              };

              return (
                <div
                  key={i}
                  onClick={() => handleAlertClick(a)}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-none border ${
                      bgColors[a.sev]
                    }`}
                  >
                    {icons[a.sev]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#fafafa] leading-snug group-hover:text-[#6366f1] transition-colors">
                      {a.text}
                    </div>
                    <div className="text-[11px] text-[#71717a] mt-0.5 truncate">
                      {a.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Workload */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
            <h3 className="font-semibold text-[14px] text-[#fafafa]">
              Загрузка команды
            </h3>
            <button
              onClick={() => switchView('team')}
              className="flex items-center gap-1 text-xs text-[#6366f1] font-medium hover:underline px-2.5 py-1 rounded-lg hover:bg-[#6366f1]/10 transition-colors"
            >
              <span>Команда</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1">
            {[...state.team]
              .sort((a, b) => b.load - a.load)
              .slice(0, 6)
              .map((u) => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <Avatar name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#fafafa] truncate leading-tight">
                      {u.name}
                    </div>
                    <div className="text-[10.5px] text-[#71717a] truncate">
                      {u.role} · {u.status}
                    </div>
                  </div>

                  <div className="w-24 h-1.5 rounded-full bg-[#27272a] overflow-hidden flex-none">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${u.load}%`,
                        backgroundColor: loadColor(u.load)
                      }}
                    />
                  </div>

                  <span className="font-mono text-xs text-[#a1a1aa] w-8 text-right flex-none">
                    {u.load}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
            <h3 className="font-semibold text-[14px] text-[#fafafa]">
              Важные документы
            </h3>
            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25">
              {docAttention.length} треб.
            </span>
          </div>

          <div className="divide-y divide-[#27272a] flex-1">
            {[...state.docs]
              .sort((a, b) => (a.status === 'ok' ? 1 : -1))
              .slice(0, 6)
              .map((d) => {
                const statusBadges = {
                  ok: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25',
                  approval: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25',
                  missing: 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25'
                };
                const statusTexts = {
                  ok: 'готов',
                  approval: 'согласование',
                  missing: 'отсутствует'
                };
                const isOverdueDoc = d.due && daysLeft(d.due) < 0;

                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-2.5 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[#71717a] flex-none" />

                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[#fafafa] truncate">
                        {d.name}
                      </div>
                      <div className="text-[10.5px] text-[#71717a] truncate">
                        {d.project ? d.project : 'компания'}
                      </div>
                    </div>

                    {d.due && (
                      <span
                        className={`font-mono text-[11px] px-2 py-0.5 rounded-md flex-none border ${
                          isOverdueDoc
                            ? 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25 font-semibold'
                            : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a]'
                        }`}
                      >
                        {fmtRu(d.due)}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleDocStatus(d.id)}
                      title="Нажмите, чтобы переключить статус документа (согласовать / перевести в работу)"
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-none border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                        statusBadges[d.status]
                      }`}
                    >
                      {statusTexts[d.status]}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Row 3: Training & Warehouse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Training */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
            <div>
              <h3 className="font-semibold text-[14px] text-[#fafafa]">
                Обучение и адаптация
              </h3>
              <div className="text-[11px] text-[#71717a]">
                модуль 360 Academy — следующий этап
              </div>
            </div>
            <GraduationCap className="w-5 h-5 text-[#8b5cf6]" />
          </div>

          <div className="p-5 space-y-4 flex-1">
            {state.training.map((t, ti) => (
              <div key={ti} className="space-y-1.5">
                <div className="flex items-center justify-between font-medium text-[12.5px] text-[#fafafa]">
                  <span>{t.name}</span>
                  <span className="font-mono text-xs text-[#a1a1aa]">{t.progress}%</span>
                </div>
                <div className="text-[11.5px] text-[#a1a1aa]">
                  {t.stage} · наставник: <b className="text-[#fafafa] font-medium">{t.mentor}</b>
                </div>
                <div className="h-1.5 rounded-full bg-[#27272a] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] transition-all duration-700"
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 text-xs text-[#71717a] pt-3 border-t border-[#27272a]">
              <Info className="w-3.5 h-3.5 flex-none text-[#6366f1]" />
              <span>
                Полный модуль тестирования, чек-листов стажировки и допусков запланирован в дорожной карте MVP 2–3.
              </span>
            </div>
          </div>
        </div>

        {/* Warehouse overview */}
        <div className="relative border border-[#27272a] bg-[#18181b] rounded-2xl overflow-hidden min-h-[160px] flex flex-col justify-end p-5 group shadow-sm">
          <img
            src={IMG.wh}
            alt="Склад"
            className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />

          <div className="relative z-10 space-y-3">
            <h3 className="text-base font-semibold text-[#fafafa]">
              Состояние склада сейчас
            </h3>

            <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
              <span className="px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25">
                свободно {inStockEq}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/25">
                на проектах {state.equipment.filter((q) => q.status === 'project').length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25">
                резерв {state.equipment.filter((q) => q.status === 'reserved').length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25">
                ремонт {inRepairEq}
              </span>

              <button
                onClick={() => switchView('equipment')}
                className="ml-auto flex items-center gap-1 text-xs text-[#6366f1] font-medium hover:underline px-2.5 py-1 rounded-lg hover:bg-[#6366f1]/10 transition-colors"
              >
                <span>Оборудование</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

        </div>

        {/* Docked ActivityFeed on xl screens when in sidebar mode */}
        {feedDisplayMode === 'sidebar' && (
          <div className="xl:col-span-4 sticky top-4 self-start">
            <ActivityFeed variant="sidebar" maxHeight="max-h-[calc(100vh-140px)]" />
          </div>
        )}
      </div>
    </div>
  );
};
