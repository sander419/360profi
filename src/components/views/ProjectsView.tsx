import React, { useState } from 'react';
import {
  LayoutGrid,
  CalendarRange,
  Milestone,
  Clock,
  Layers,
  Download,
  AlertTriangle,
  BellRing,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CircularProgress } from '../common/CircularProgress';
import { BreakdownBars } from '../common/BreakdownBars';
import { Avatar } from '../common/Avatar';
import { ProjectsGanttChart } from '../projects/ProjectsGanttChart';
import { ProjectsHealthCard } from '../projects/ProjectsHealthCard';
import { fmtRu, daysLeft } from '../../data/seedData';
import { exportProjectsToCsv } from '../../utils/exportCsv';
import { getProjectBudgetStats } from '../../utils/budgetAlerts';

type ProjectViewMode = 'grid' | 'gantt';

export const ProjectsView: React.FC = () => {
  const {
    state,
    projFilter,
    setProjFilter,
    openProject,
    userById,
    getReadiness,
    triggerBudgetThresholdCheck,
    setIsNewProjectModalOpen
  } = useApp();

  const [viewMode, setViewMode] = useState<ProjectViewMode>('gantt');

  const filterOptions: { key: 'active' | 'done' | 'all'; label: string }[] = [
    { key: 'active', label: 'Активные' },
    { key: 'done', label: 'Завершённые' },
    { key: 'all', label: 'Все проекты' }
  ];

  const projectsList = state.projects
    .filter((p) => (projFilter === 'all' ? true : p.status === projFilter))
    .sort((a, b) => daysLeft(a.date) - daysLeft(b.date));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Filter Controls */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
              Проекты
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] font-medium font-mono">
              {projectsList.length} в выборке
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Каждое мероприятие — отдельный проект с процентом готовности по 5 осям и графиком вех
          </p>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Switcher: Cards vs Gantt */}
          <div className="flex items-center p-1 bg-[#18181b] border border-[#27272a] rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'gantt'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
              title="Диаграмма Ганта: временная шкала вех и дедлайнов"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Диаграмма Ганта</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
              title="Карточки проектов"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Карточки</span>
            </button>
          </div>

          {/* Filter Pills: Active / Done / All */}
          <div className="flex items-center gap-1.5">
            {filterOptions.map((opt) => {
              const isActive = projFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setProjFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#27272a] text-[#fafafa] border border-[#3f3f46]'
                      : 'border border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Check Budget Alerts Button */}
          <button
            type="button"
            onClick={() => triggerBudgetThresholdCheck()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27272a] bg-[#18181b] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-amber-500/40 hover:bg-amber-500/10 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Проверить пороги бюджета (80% и 95%) для всех активных проектов"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span>Контроль лимитов</span>
          </button>

          {/* Export to CSV Button */}
          <button
            type="button"
            onClick={() => exportProjectsToCsv(projectsList, getReadiness, userById)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27272a] bg-[#18181b] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] hover:bg-[#27272a]/50 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Экспортировать текущий список проектов в формате CSV (Excel)"
          >
            <Download className="w-3.5 h-3.5 text-[#6366f1]" />
            <span>Экспорт CSV</span>
          </button>

          {/* New Project Button */}
          <button
            type="button"
            onClick={() => setIsNewProjectModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-[#09090b] text-xs font-semibold transition-all cursor-pointer shadow-md shadow-[#38bdf8]/20 active:scale-95"
            title="Открыть новый проект (P)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новый проект</span>
            <kbd className="text-[9px] font-mono bg-black/15 px-1 py-0.2 rounded ml-0.5">P</kbd>
          </button>
        </div>
      </div>

      {/* High-Level Project Health Summary Card */}
      <ProjectsHealthCard onOpenProject={openProject} />

      {/* View Content: Gantt Chart or Card Grid */}
      {viewMode === 'gantt' ? (
        <ProjectsGanttChart
          onOpenProject={openProject}
          statusFilter={projFilter}
        />
      ) : (
        /* Grid of Project Cards */
        projectsList.length === 0 ? (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-12 text-center text-[#a1a1aa]">
            Нет проектов в этом фильтре
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectsList.map((project) => {
              const readiness = getReadiness(project);
              const dl = daysLeft(project.date);
              const overdueDeadlines = project.deadlines.filter(
                (d) => !d.done && daysLeft(d.due) < 0
              ).length;

              const isUrgent = dl <= 1;
              const isSoon = dl > 1 && dl <= 4;

              return (
                <div
                  key={project.id}
                  onClick={() => openProject(project.id)}
                  className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col group"
                >
                  {/* Image Header */}
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={project.img}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/40 to-transparent" />

                    {/* Top tags */}
                    <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between z-10">
                      <span
                        className={`text-[10.5px] font-medium px-2.5 py-0.5 rounded-full backdrop-blur-sm ${
                          project.status === 'active'
                            ? 'bg-[#6366f1]/25 text-[#fafafa] border border-[#6366f1]/40'
                            : 'bg-[#09090b]/70 text-[#a1a1aa] border border-[#27272a]'
                        }`}
                      >
                        {project.status === 'active' ? 'в работе' : 'завершён'}
                      </span>

                      <span
                        className={`font-mono text-[11px] px-2.5 py-0.5 rounded-lg backdrop-blur-md border ${
                          project.status === 'active' && isUrgent
                            ? 'bg-[#f43f5e]/90 text-white font-medium border-[#f43f5e]'
                            : project.status === 'active' && isSoon
                            ? 'bg-[#f59e0b]/90 text-[#09090b] font-medium border-[#f59e0b]'
                            : 'bg-[#09090b]/70 text-[#a1a1aa] border-[#27272a]'
                        }`}
                      >
                        {fmtRu(project.date)}
                        {project.status === 'active' && (
                          <span>
                            {' '}
                            ·{' '}
                            {dl === 0
                              ? 'сегодня'
                              : dl > 0
                              ? `через ${dl} дн`
                              : `${Math.abs(dl)} дн назад`}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* ID Tag */}
                    <div className="absolute bottom-2 left-3 z-10 font-mono text-[11px] font-medium text-[#fafafa] bg-[#09090b]/90 px-2 py-0.5 rounded-md border border-[#27272a]">
                      {project.id}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[#fafafa] group-hover:text-[#6366f1] transition-colors leading-snug">
                        {project.title}
                      </h3>
                      <div className="text-xs text-[#71717a] mt-1 mb-3.5 truncate">
                        {project.client} · {project.venue}
                      </div>

                      {/* Readiness Ring + 5-axis breakdown */}
                      <div className="flex items-center gap-3.5 mb-3">
                        <CircularProgress value={readiness} size={58} strokeWidth={5} />
                        <div className="flex-1 min-w-0">
                          <BreakdownBars breakdown={project.breakdown} />
                        </div>
                      </div>

                      {/* Budget status line */}
                      {(() => {
                        const budgetStats = getProjectBudgetStats(project);
                        return (
                          <div className="pt-2 border-t border-[#27272a]/60 flex items-center justify-between text-xs">
                            <span className="text-[#71717a] font-mono text-[11px]">
                              {project.budget}
                            </span>
                            {budgetStats.isOver95 ? (
                              <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold text-[#f43f5e] bg-[#f43f5e]/15 px-2 py-0.5 rounded-md border border-[#f43f5e]/30">
                                <AlertTriangle className="w-3 h-3" />
                                {budgetStats.percent}% лимит
                              </span>
                            ) : budgetStats.isOver80 ? (
                              <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold text-[#f59e0b] bg-[#f59e0b]/15 px-2 py-0.5 rounded-md border border-[#f59e0b]/30">
                                <AlertTriangle className="w-3 h-3" />
                                {budgetStats.percent}% порог
                              </span>
                            ) : (
                              <span className="font-mono text-[10.5px] text-[#71717a]">
                                {budgetStats.percent}% освоено
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#27272a] mt-auto">
                      {/* Team Avatar Stack */}
                      <div className="flex items-center -space-x-2">
                        {project.teamIds.slice(0, 4).map((uid) => {
                          const member = userById(uid);
                          if (!member) return null;
                          return (
                            <div
                              key={uid}
                              className="ring-2 ring-[#18181b] rounded-full"
                            >
                              <Avatar name={member.name} size="sm" />
                            </div>
                          );
                        })}
                        {project.teamIds.length > 4 && (
                          <div className="w-5 h-5 rounded-full bg-[#27272a] text-[#a1a1aa] font-mono text-[9px] flex items-center justify-center ring-2 ring-[#18181b]">
                            +{project.teamIds.length - 4}
                          </div>
                        )}
                      </div>

                      {/* Overdue deadlines chip */}
                      <div>
                        {overdueDeadlines > 0 ? (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25">
                            {overdueDeadlines} просроч. дедлайн
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25">
                            дедлайны в сроке
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
