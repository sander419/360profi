import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  CartesianGrid
} from 'recharts';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Milestone,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project, ProjectDeadline } from '../../types';
import { fmtRu, daysLeft, loadColor } from '../../data/seedData';

interface ProjectsGanttChartProps {
  onOpenProject: (id: string) => void;
  statusFilter?: 'active' | 'done' | 'all';
}

interface GanttItem {
  id: string;
  project: Project;
  shortLabel: string;
  name: string;
  client: string;
  venue: string;
  eventDate: string;
  eventDaysLeft: number;
  readiness: number;
  startDay: number;
  endDay: number;
  duration: number;
  spacer: number;
  completedDays: number;
  remainingDays: number;
  deadlines: (ProjectDeadline & {
    dayOffset: number;
    isOverdue: boolean;
    index: number;
  })[];
  totalDeadlines: number;
  doneDeadlines: number;
  overdueDeadlines: number;
}

export const ProjectsGanttChart: React.FC<ProjectsGanttChartProps> = ({
  onOpenProject,
  statusFilter = 'active'
}) => {
  const { state, getReadiness, toggleDeadline } = useApp();

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [selectedMilestoneFilter, setSelectedMilestoneFilter] = useState<'all' | 'pending' | 'overdue' | 'done'>('all');

  // Filter projects by status
  const filteredProjects = useMemo(() => {
    return state.projects.filter((p) => {
      if (statusFilter === 'all') return true;
      return p.status === statusFilter;
    });
  }, [state.projects, statusFilter]);

  // Compute Gantt Chart Data
  const { chartData, minDay, maxDay, kpis } = useMemo(() => {
    let globalMin = 0;
    let globalMax = 5;
    let totalDl = 0;
    let doneDl = 0;
    let overdueDl = 0;

    const items: GanttItem[] = filteredProjects.map((p) => {
      const pReadiness = getReadiness(p);
      const evDays = daysLeft(p.date);

      // Extract and map deadlines
      const deadlinesWithOffset = (p.deadlines || []).map((dl, idx) => {
        const offset = daysLeft(dl.due);
        const isOverdue = !dl.done && offset < 0;
        totalDl++;
        if (dl.done) doneDl++;
        if (isOverdue) overdueDl++;

        return {
          ...dl,
          dayOffset: offset,
          isOverdue,
          index: idx
        };
      });

      // Calculate project start date on timeline
      // If project has deadlines, the start is either the earliest deadline or ~7 days before event
      const minDlOffset = deadlinesWithOffset.length > 0
        ? Math.min(...deadlinesWithOffset.map((d) => d.dayOffset))
        : evDays - 5;

      const projectStart = Math.min(minDlOffset - 1, evDays - 6);
      const projectEnd = evDays + 1; // +1 to account for packdown day
      const duration = Math.max(projectEnd - projectStart, 2);

      if (projectStart < globalMin) globalMin = projectStart;
      if (projectEnd > globalMax) globalMax = projectEnd;

      const completedDays = Math.max(0.5, +(duration * (pReadiness / 100)).toFixed(1));
      const remainingDays = Math.max(0, +(duration - completedDays).toFixed(1));

      return {
        id: p.id,
        project: p,
        shortLabel: p.id,
        name: `${p.id} · ${p.title}`,
        client: p.client,
        venue: p.venue,
        eventDate: p.date,
        eventDaysLeft: evDays,
        readiness: pReadiness,
        startDay: projectStart,
        endDay: projectEnd,
        duration,
        spacer: 0, // calculated next
        completedDays,
        remainingDays,
        deadlines: deadlinesWithOffset,
        totalDeadlines: deadlinesWithOffset.length,
        doneDeadlines: deadlinesWithOffset.filter((d) => d.done).length,
        overdueDeadlines: deadlinesWithOffset.filter((d) => d.isOverdue).length
      };
    });

    // Add padding to bounds
    const chartMin = Math.min(globalMin - 2, -4);
    const chartMax = Math.max(globalMax + 3, 14);

    // Adjust spacer for stacked bar alignment from chartMin
    const normalizedItems = items
      .sort((a, b) => a.eventDaysLeft - b.eventDaysLeft)
      .map((item) => ({
        ...item,
        spacer: Math.max(0, item.startDay - chartMin)
      }));

    return {
      chartData: normalizedItems,
      minDay: chartMin,
      maxDay: chartMax,
      kpis: {
        totalProjects: items.length,
        totalDeadlines: totalDl,
        doneDeadlines: doneDl,
        overdueDeadlines: overdueDl,
        pendingDeadlines: totalDl - doneDl
      }
    };
  }, [filteredProjects, getReadiness]);

  // Format tick labels on X axis
  const formatXAxisTick = (val: number) => {
    const d = new Date();
    d.setDate(d.getDate() + val);
    const day = d.getDate();
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const month = months[d.getMonth()];

    if (val === 0) return 'Сегодня';
    return `${day} ${month}`;
  };

  const selectedProject = expandedProjectId
    ? chartData.find((p) => p.id === expandedProjectId)
    : null;

  return (
    <div className="space-y-6">
      {/* Milestone & Deadline KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Milestones */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Контрольных точек</div>
            <div className="text-xl font-bold text-[#fafafa] font-mono mt-0.5">
              {kpis.totalDeadlines}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Milestone className="w-4 h-4" />
          </div>
        </div>

        {/* Done Milestones */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#10b981] font-medium">Выполнено вех</div>
            <div className="text-xl font-bold text-[#10b981] font-mono mt-0.5">
              {kpis.doneDeadlines}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Pending Milestones */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#f59e0b] font-medium">В графике (активно)</div>
            <div className="text-xl font-bold text-[#f59e0b] font-mono mt-0.5">
              {kpis.pendingDeadlines - kpis.overdueDeadlines}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Overdue Milestones */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#f43f5e] font-medium">Просрочено вех</div>
            <div className="text-xl font-bold text-[#f43f5e] font-mono mt-0.5">
              {kpis.overdueDeadlines}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f43f5e]/15 border border-[#f43f5e]/25 flex items-center justify-center text-[#f43f5e]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Recharts Gantt Chart Canvas */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 shadow-sm">
        {/* Gantt Header with Title and Legend */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[#27272a]">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#6366f1]" />
              <h2 className="text-base font-semibold text-[#fafafa]">
                Временная шкала проектов и контрольных точек (Gantt)
              </h2>
            </div>
            <p className="text-xs text-[#71717a] mt-0.5">
              Шкала времени от подготовки к дате монтажа и проведения · Кликните по проекту для перехода в детали
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-[#a1a1aa] flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-[#10b981]" />
              <span>Готовность / Выполнено</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-[#6366f1]" />
              <span>Оставшийся срок</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
              <span>Красная линия: Сегодня</span>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {chartData.length === 0 ? (
          <div className="py-16 text-center text-[#71717a] text-sm">
            Нет проектов для отображения на диаграмме Ганта
          </div>
        ) : (
          <div className="mt-6">
            {/* Recharts Gantt Chart */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                  barSize={18}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#27272a"
                  />

                  {/* X Axis: Time in Days from MinDay to MaxDay */}
                  <XAxis
                    type="number"
                    domain={[0, maxDay - minDay]}
                    tickCount={8}
                    stroke="#71717a"
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickFormatter={(val) => formatXAxisTick(val + minDay)}
                  />

                  {/* Y Axis: Projects */}
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={70}
                    stroke="#71717a"
                    tick={{ fill: '#fafafa', fontSize: 12, fontWeight: 500 }}
                  />

                  {/* Today Reference Line */}
                  <ReferenceLine
                    x={0 - minDay}
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: 'Сегодня',
                      position: 'top',
                      fill: '#f43f5e',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  />

                  {/* Rich Custom Tooltip */}
                  <Tooltip
                    content={<CustomGanttTooltip minDay={minDay} onOpenProject={onOpenProject} />}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  />

                  {/* Spacer Bar (Transparent offset from minDay to project start) */}
                  <Bar dataKey="spacer" stackId="gantt" fill="transparent" isAnimationActive={false} />

                  {/* Completed Duration Bar (Green readiness) */}
                  <Bar
                    dataKey="completedDays"
                    stackId="gantt"
                    fill="#10b981"
                    radius={[3, 0, 0, 3]}
                    onClick={(data) => {
                      if (data?.id) onOpenProject(data.id);
                    }}
                    cursor="pointer"
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-comp-${entry.id}`}
                        fill={entry.readiness >= 85 ? '#10b981' : entry.readiness >= 50 ? '#6366f1' : '#f59e0b'}
                      />
                    ))}
                  </Bar>

                  {/* Remaining Duration Bar (Indigo/Zinc) */}
                  <Bar
                    dataKey="remainingDays"
                    stackId="gantt"
                    fill="#3f3f46"
                    radius={[0, 3, 3, 0]}
                    onClick={(data) => {
                      if (data?.id) onOpenProject(data.id);
                    }}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Visual Milestones Timeline Rows for each project */}
            <div className="mt-4 pt-4 border-t border-[#27272a] space-y-3">
              <div className="flex items-center justify-between text-xs text-[#71717a]">
                <span className="font-medium text-[#a1a1aa]">
                  Контрольные точки и дедлайны по проектам:
                </span>
                <span className="text-[11px]">
                  Нажмите на проект для раскрытия майлстоунов или перехода к задаче
                </span>
              </div>

              <div className="space-y-2">
                {chartData.map((item) => {
                  const isExpanded = expandedProjectId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${
                        isExpanded
                          ? 'bg-[#18181b] border-[#6366f1]/50 shadow-md'
                          : 'bg-[#09090b]/60 border-[#27272a] hover:border-[#3f3f46]'
                      }`}
                    >
                      {/* Row Header Bar */}
                      <div
                        onClick={() => setExpandedProjectId(isExpanded ? null : item.id)}
                        className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Project ID Pill */}
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#fafafa]">
                            {item.id}
                          </span>

                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#fafafa] truncate flex items-center gap-2">
                              <span>{item.project.title}</span>
                              <span className="text-[11px] text-[#71717a] font-normal truncate hidden md:inline">
                                ({item.venue})
                              </span>
                            </div>
                            <div className="text-[11px] text-[#71717a] flex items-center gap-2 mt-0.5">
                              <span>Дата события: <strong className="text-[#a1a1aa]">{fmtRu(item.eventDate)}</strong></span>
                              <span>·</span>
                              <span className={item.eventDaysLeft < 0 ? 'text-[#71717a]' : item.eventDaysLeft <= 2 ? 'text-[#f43f5e]' : 'text-[#f59e0b]'}>
                                {item.eventDaysLeft === 0
                                  ? 'сегодня'
                                  : item.eventDaysLeft > 0
                                  ? `через ${item.eventDaysLeft} дн.`
                                  : `${Math.abs(item.eventDaysLeft)} дн. назад`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Readiness badge, deadlines count & expand chevron */}
                        <div className="flex items-center gap-3 flex-none">
                          {/* Deadlines Badge */}
                          <div className="hidden sm:flex items-center gap-1 text-[11px]">
                            {item.overdueDeadlines > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {item.overdueDeadlines} просроч.
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {item.doneDeadlines}/{item.totalDeadlines} вех
                              </span>
                            )}
                          </div>

                          {/* Progress Pill */}
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-[#27272a] overflow-hidden hidden md:block">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${item.readiness}%`,
                                  backgroundColor: loadColor(item.readiness)
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs font-semibold text-[#a1a1aa] w-9 text-right">
                              {item.readiness}%
                            </span>
                          </div>

                          {/* Action & Toggle Icon */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenProject(item.id);
                            }}
                            className="p-1 rounded-md text-[#71717a] hover:text-[#fafafa] hover:bg-white/5 transition-colors"
                            title="Открыть карточку проекта"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <div className="text-[#71717a]">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Milestones & Deadlines Drawer */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-[#27272a]/60 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between mb-3 text-xs text-[#a1a1aa]">
                            <span className="font-medium text-[#fafafa] flex items-center gap-1.5">
                              <Milestone className="w-3.5 h-3.5 text-[#6366f1]" />
                              <span>Контрольные дедлайны проекта</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => onOpenProject(item.id)}
                              className="text-[#6366f1] hover:text-[#818cf8] font-medium transition-colors flex items-center gap-1"
                            >
                              <span>Открыть полный чек-лист</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>

                          {item.deadlines.length === 0 ? (
                            <div className="text-xs text-[#71717a] py-3 text-center bg-[#18181b]/50 rounded-lg">
                              Для этого проекта ещё не созданы дедлайны
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {item.deadlines.map((dl) => {
                                return (
                                  <div
                                    key={dl.index}
                                    onClick={() => toggleDeadline(item.id, dl.index)}
                                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                                      dl.done
                                        ? 'bg-[#10b981]/5 border-[#10b981]/20 text-[#10b981]'
                                        : dl.isOverdue
                                        ? 'bg-[#f43f5e]/10 border-[#f43f5e]/30 text-[#f43f5e]'
                                        : 'bg-[#18181b] border-[#27272a] text-[#fafafa] hover:border-[#3f3f46]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={`w-4 h-4 rounded-md flex items-center justify-center flex-none border transition-colors ${
                                          dl.done
                                            ? 'bg-[#10b981] border-[#10b981] text-[#09090b]'
                                            : dl.isOverdue
                                            ? 'border-[#f43f5e] text-[#f43f5e]'
                                            : 'border-[#3f3f46] text-transparent hover:border-[#6366f1]'
                                        }`}
                                      >
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </div>

                                      <span className={`truncate font-medium ${dl.done ? 'line-through opacity-75' : ''}`}>
                                        {dl.t}
                                      </span>
                                    </div>

                                    {/* Due Badge */}
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded flex-none ${
                                        dl.done
                                          ? 'bg-[#10b981]/15 text-[#10b981]'
                                          : dl.isOverdue
                                          ? 'bg-[#f43f5e]/20 text-[#f43f5e] font-semibold'
                                          : 'bg-[#27272a] text-[#a1a1aa]'
                                      }`}
                                    >
                                      {fmtRu(dl.due)}
                                      {!dl.done && (
                                        <span>
                                          {' '}
                                          ({dl.dayOffset === 0
                                            ? 'сегодня'
                                            : dl.dayOffset > 0
                                            ? `+${dl.dayOffset}д`
                                            : `${dl.dayOffset}д`})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface CustomGanttTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  minDay: number;
  onOpenProject: (id: string) => void;
}

const CustomGanttTooltip: React.FC<CustomGanttTooltipProps> = ({
  active,
  payload,
  minDay,
  onOpenProject
}) => {
  if (!active || !payload || !payload.length) return null;

  const data: GanttItem = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-[#18181b] border border-[#3f3f46] rounded-xl p-3.5 shadow-2xl max-w-sm z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#27272a]">
        <div>
          <div className="font-mono text-[10px] font-semibold text-[#6366f1]">
            {data.id}
          </div>
          <div className="font-semibold text-sm text-[#fafafa] leading-snug">
            {data.project.title}
          </div>
          <div className="text-[11px] text-[#71717a] mt-0.5">
            {data.client} · {data.venue}
          </div>
        </div>

        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-none ${
            data.project.status === 'active'
              ? 'bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/30'
              : 'bg-zinc-800 text-[#a1a1aa]'
          }`}
        >
          {data.project.status === 'active' ? 'в работе' : 'завершён'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 my-3 py-2 px-2.5 rounded-lg bg-[#09090b] border border-[#27272a]">
        <div>
          <div className="text-[10px] text-[#71717a]">Готовность</div>
          <div className="font-mono font-bold text-sm text-[#fafafa] mt-0.5">
            {data.readiness}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717a]">Дата мероприятия</div>
          <div className="font-mono font-semibold text-xs text-[#fafafa] mt-0.5">
            {fmtRu(data.eventDate)} ({data.eventDaysLeft >= 0 ? `через ${data.eventDaysLeft} дн` : `${Math.abs(data.eventDaysLeft)} дн назад`})
          </div>
        </div>
      </div>

      {/* Deadlines List in Tooltip */}
      <div>
        <div className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Контрольные дедлайны:</span>
          <span>{data.doneDeadlines}/{data.totalDeadlines}</span>
        </div>

        {data.deadlines.length === 0 ? (
          <div className="text-[11px] text-[#71717a] italic">Нет дедлайнов</div>
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {data.deadlines.map((dl, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 text-[11px] py-0.5"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-none ${
                      dl.done
                        ? 'bg-[#10b981]'
                        : dl.isOverdue
                        ? 'bg-[#f43f5e]'
                        : 'bg-[#f59e0b]'
                    }`}
                  />
                  <span className={`truncate ${dl.done ? 'line-through text-[#71717a]' : 'text-[#fafafa]'}`}>
                    {dl.t}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#71717a] flex-none">
                  {fmtRu(dl.due)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-[#27272a] text-[10px] text-[#6366f1] text-center font-medium">
        Кликните, чтобы открыть карточку проекта
      </div>
    </div>
  );
};
