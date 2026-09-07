import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Link2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layers,
  Filter,
  Check,
  ArrowRight,
  ShieldAlert,
  Info,
  ExternalLink
} from 'lucide-react';
import { Task, TeamMember } from '../../types';
import { fmtRu, daysLeft, D, initials } from '../../data/seedData';
import { Avatar } from '../common/Avatar';

interface TasksGanttChartProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onCycleTask: (id: string) => void;
  onOpenProject?: (projectId: string) => void;
  userById: (id: string) => TeamMember | undefined;
  projLabel: (projectId: string) => string;
  isOverdue: (task: Task) => boolean;
}

interface GanttTaskItem extends Task {
  startDay: number;
  endDay: number;
  duration: number;
  rowIndex: number;
  hasBlockers: boolean;
  isBlockerForOthers: boolean;
  unresolvedBlockerCount: number;
  overdueBlockerCount: number;
}

interface DependencyLink {
  id: string;
  fromId: string;
  toId: string;
  fromTask: GanttTaskItem;
  toTask: GanttTaskItem;
  status: 'resolved' | 'critical' | 'active';
  pathD: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const TasksGanttChart: React.FC<TasksGanttChartProps> = ({
  tasks,
  onToggleTask,
  onCycleTask,
  onOpenProject,
  userById,
  projLabel,
  isOverdue
}) => {
  // Local view controls
  const [dayWidth, setDayWidth] = useState<number>(54); // 40, 54, 72
  const [onlyDependencies, setOnlyDependencies] = useState<boolean>(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const ROW_HEIGHT = 52;

  // Process tasks into Gantt items with schedule calculations
  const { ganttTasks, minDay, maxDay, taskMap } = useMemo(() => {
    // 1. Initial mapping of timeline boundaries
    let globalMin = -4;
    let globalMax = 8;

    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));

    // Filter tasks if onlyDependencies is active
    const candidateTasks = onlyDependencies
      ? tasks.filter((t) => {
          const hasBlocked = (t.blockedBy && t.blockedBy.length > 0);
          const isBlocking = tasks.some((other) => other.blockedBy && other.blockedBy.includes(t.id));
          return hasBlocked || isBlocking;
        })
      : tasks;

    // Sort candidate tasks: group by project, then by timeline start
    const sortedTasks = [...candidateTasks].sort((a, b) => {
      if (a.project !== b.project) return a.project.localeCompare(b.project);
      const aDue = daysLeft(a.due);
      const bDue = daysLeft(b.due);
      return aDue - bDue;
    });

    const items: GanttTaskItem[] = sortedTasks.map((t, idx) => {
      const eDay = daysLeft(t.due);
      let sDay = t.start ? daysLeft(t.start) : eDay - (t.durationDays || 2);
      if (sDay >= eDay) sDay = eDay - 1;
      const duration = Math.max(eDay - sDay, 1);

      if (sDay < globalMin) globalMin = sDay;
      if (eDay > globalMax) globalMax = eDay;

      // Count blockers
      let unresolved = 0;
      let overdue = 0;
      (t.blockedBy || []).forEach((bId) => {
        const blocker = map.get(bId);
        if (blocker && blocker.status !== 'done') {
          unresolved++;
          if (daysLeft(blocker.due) < 0) {
            overdue++;
          }
        }
      });

      const isBlocking = tasks.some((other) => other.blockedBy && other.blockedBy.includes(t.id));

      return {
        ...t,
        startDay: sDay,
        endDay: eDay,
        duration,
        rowIndex: idx,
        hasBlockers: (t.blockedBy && t.blockedBy.length > 0) || false,
        isBlockerForOthers: isBlocking,
        unresolvedBlockerCount: unresolved,
        overdueBlockerCount: overdue
      };
    });

    // Ensure we have padding around the days
    const paddedMin = globalMin - 1;
    const paddedMax = globalMax + 2;

    const taskItemMap = new Map<string, GanttTaskItem>();
    items.forEach((item) => taskItemMap.set(item.id, item));

    return {
      ganttTasks: items,
      minDay: paddedMin,
      maxDay: paddedMax,
      taskMap: taskItemMap
    };
  }, [tasks, onlyDependencies]);

  // Days range array for columns header
  const daysRange = useMemo(() => {
    const list: { offset: number; dateStr: string; isToday: boolean; label: string }[] = [];
    for (let d = minDay; d <= maxDay; d++) {
      const isToday = d === 0;
      const dateStr = fmtRu(D(d));
      let label = `${d > 0 ? '+' : ''}${d}`;
      if (isToday) label = 'Сегодня';
      else if (d === -1) label = 'Вчера';
      else if (d === 1) label = 'Завтра';

      list.push({
        offset: d,
        dateStr,
        isToday,
        label
      });
    }
    return list;
  }, [minDay, maxDay]);

  // Total canvas width
  const totalTimelineWidth = daysRange.length * dayWidth;

  // Compute visual dependency connection lines (SVG paths)
  const dependencyLinks: DependencyLink[] = useMemo(() => {
    const links: DependencyLink[] = [];

    ganttTasks.forEach((targetTask) => {
      if (!targetTask.blockedBy || targetTask.blockedBy.length === 0) return;

      targetTask.blockedBy.forEach((sourceId) => {
        const sourceTask = taskMap.get(sourceId);
        if (!sourceTask) return; // Blocker not in current view or dataset

        // Geometric coordinates in the timeline canvas
        const sourceBarLeft = (sourceTask.startDay - minDay) * dayWidth;
        const sourceBarWidth = Math.max(sourceTask.duration * dayWidth, 24);
        const sourceRightX = sourceBarLeft + sourceBarWidth;
        const sourceCenterY = sourceTask.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        const targetBarLeft = (targetTask.startDay - minDay) * dayWidth;
        const targetLeftX = targetBarLeft;
        const targetCenterY = targetTask.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        // Blocker status:
        // - resolved: predecessor is done
        // - critical: predecessor is overdue and not done
        // - active: predecessor is currently in progress or planned
        let linkStatus: 'resolved' | 'critical' | 'active' = 'active';
        if (sourceTask.status === 'done') {
          linkStatus = 'resolved';
        } else if (daysLeft(sourceTask.due) < 0) {
          linkStatus = 'critical';
        }

        // Generate orthogonal stepped path
        let pathD = '';
        const gap = targetLeftX - sourceRightX;

        if (gap >= 16) {
          // Standard forward dependency: Step right -> Step vertical -> Step right into target
          const midX = sourceRightX + gap / 2;
          pathD = `M ${sourceRightX} ${sourceCenterY} L ${midX} ${sourceCenterY} L ${midX} ${targetCenterY} L ${targetLeftX} ${targetCenterY}`;
        } else {
          // Backward or tight schedule overlap: Route around
          const bendX = sourceRightX + 12;
          const verticalY = sourceCenterY + (targetCenterY > sourceCenterY ? 16 : -16);
          const preTargetX = targetLeftX - 12;
          pathD = `M ${sourceRightX} ${sourceCenterY} L ${bendX} ${sourceCenterY} L ${bendX} ${verticalY} L ${preTargetX} ${verticalY} L ${preTargetX} ${targetCenterY} L ${targetLeftX} ${targetCenterY}`;
        }

        links.push({
          id: `link_${sourceTask.id}_${targetTask.id}`,
          fromId: sourceTask.id,
          toId: targetTask.id,
          fromTask: sourceTask,
          toTask: targetTask,
          status: linkStatus,
          pathD,
          startX: sourceRightX,
          startY: sourceCenterY,
          endX: targetLeftX,
          endY: targetCenterY
        });
      });
    });

    return links;
  }, [ganttTasks, taskMap, minDay, dayWidth, ROW_HEIGHT]);

  // Telemetry KPIs
  const telemetry = useMemo(() => {
    let resolvedCount = 0;
    let criticalCount = 0;
    let activeCount = 0;

    dependencyLinks.forEach((l) => {
      if (l.status === 'resolved') resolvedCount++;
      else if (l.status === 'critical') criticalCount++;
      else activeCount++;
    });

    const tasksInChains = new Set<string>();
    dependencyLinks.forEach((l) => {
      tasksInChains.add(l.fromId);
      tasksInChains.add(l.toId);
    });

    return {
      totalLinks: dependencyLinks.length,
      resolvedCount,
      criticalCount,
      activeCount,
      chainTasksCount: tasksInChains.size
    };
  }, [dependencyLinks]);

  // Center scroll to "Today" on initial mount
  useEffect(() => {
    if (timelineScrollRef.current) {
      const todayX = (0 - minDay) * dayWidth;
      timelineScrollRef.current.scrollLeft = Math.max(0, todayX - 220);
    }
  }, [minDay, dayWidth]);

  return (
    <div className="space-y-4">
      {/* Dependency Telemetry & Legend Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Sequences */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Связей и цепочек</div>
            <div className="text-xl font-bold text-[#fafafa] font-mono mt-0.5">
              {telemetry.totalLinks}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Link2 className="w-4 h-4" />
          </div>
        </div>

        {/* Critical Blockers */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#f43f5e] font-medium">Критических блокеров</div>
            <div className="text-xl font-bold text-[#f43f5e] font-mono mt-0.5">
              {telemetry.criticalCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f43f5e]/15 border border-[#f43f5e]/30 flex items-center justify-center text-[#f43f5e]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Active Dependencies */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#818cf8] font-medium">В ожидании / В работе</div>
            <div className="text-xl font-bold text-[#818cf8] font-mono mt-0.5">
              {telemetry.activeCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 flex items-center justify-center text-[#818cf8]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Resolved Dependencies */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#10b981] font-medium">Разблокировано вех</div>
            <div className="text-xl font-bold text-[#10b981] font-mono mt-0.5">
              {telemetry.resolvedCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Gantt Card */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Controls Toolbar: Legend & Zoom */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between flex-wrap gap-3 bg-[#18181b]">
          <div className="flex items-center gap-4 flex-wrap text-xs text-[#a1a1aa]">
            <div className="flex items-center gap-1.5 font-medium text-[#fafafa]">
              <Link2 className="w-4 h-4 text-[#6366f1]" />
              <span>Цепочки зависимостей задач:</span>
            </div>

            {/* Line Legend */}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#f43f5e] rounded-full inline-block" />
                <span className="text-[#f43f5e] font-medium">Блокер (просрочен)</span>
              </span>

              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#818cf8] rounded-full inline-block" />
                <span>В процессе (план)</span>
              </span>

              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#10b981] rounded-full inline-block" />
                <span className="text-[#10b981]">Разблокировано (выполнено)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter: Only Tasks with Dependencies */}
            <button
              type="button"
              onClick={() => setOnlyDependencies((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                onlyDependencies
                  ? 'bg-[#6366f1]/20 border-[#6366f1] text-[#818cf8]'
                  : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
              }`}
              title="Показать только задачи, у которых есть связи или блокеры"
            >
              <Filter className="w-3 h-3" />
              <span>{onlyDependencies ? 'Все задачи' : 'Только цепочки связей'}</span>
            </button>

            {/* Zoom Day Width Controls */}
            <div className="flex items-center bg-[#09090b] border border-[#27272a] rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDayWidth((w) => Math.max(38, w - 8))}
                className="p-1.5 text-[#71717a] hover:text-[#fafafa] rounded-lg transition-colors"
                title="Уменьшить масштаб (сжать таймлайн)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] text-[#71717a]">{dayWidth}px</span>
              <button
                type="button"
                onClick={() => setDayWidth((w) => Math.min(80, w + 8))}
                className="p-1.5 text-[#71717a] hover:text-[#fafafa] rounded-lg transition-colors"
                title="Увеличить масштаб (растянуть дни)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Hover Link Banner */}
        {hoveredLinkId && (
          <div className="bg-[#09090b] border-b border-[#27272a] px-4 py-2 flex items-center justify-between text-xs animate-in fade-in duration-100">
            {(() => {
              const link = dependencyLinks.find((l) => l.id === hoveredLinkId);
              if (!link) return null;
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#818cf8] flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Связь зависимости:</span>
                  </span>
                  <span className="text-[#a1a1aa] truncate max-w-xs">
                    «{link.fromTask.title}»
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#71717a]" />
                  <span className="font-medium text-[#fafafa] truncate max-w-xs">
                    «{link.toTask.title}»
                  </span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      link.status === 'critical'
                        ? 'bg-[#f43f5e]/15 border-[#f43f5e]/30 text-[#f43f5e]'
                        : link.status === 'resolved'
                        ? 'bg-[#10b981]/15 border-[#10b981]/30 text-[#10b981]'
                        : 'bg-[#6366f1]/15 border-[#6366f1]/30 text-[#818cf8]'
                    }`}
                  >
                    {link.status === 'critical'
                      ? 'Критический блокер: предшественник просрочен'
                      : link.status === 'resolved'
                      ? 'Разблокировано: предшественник выполнен'
                      : 'В процессе: ожидается завершение'}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Split Gantt View: Left Fixed Task Meta Column + Right Synchronized Timeline Canvas */}
        <div ref={containerRef} className="flex min-h-[420px] max-h-[640px] overflow-hidden">
          {/* Left Panel: Task Metadata Table */}
          <div className="w-[300px] sm:w-[360px] md:w-[420px] flex-none border-r border-[#27272a] bg-[#18181b] z-20 flex flex-col shadow-lg">
            {/* Table Header */}
            <div className="h-12 border-b border-[#27272a] px-4 flex items-center justify-between text-[11px] font-semibold text-[#71717a] uppercase tracking-wider bg-[#18181b]">
              <span>Задача и проект</span>
              <span>Ответств. / Срок</span>
            </div>

            {/* Task Rows List */}
            <div className="overflow-y-auto flex-1 divide-y divide-[#27272a]/40 select-none">
              {ganttTasks.map((task) => {
                const isHovered =
                  hoveredTaskId === task.id ||
                  dependencyLinks.some(
                    (l) =>
                      l.id === hoveredLinkId && (l.fromId === task.id || l.toId === task.id)
                  );
                const isDone = task.status === 'done';
                const overdue = isOverdue(task);

                return (
                  <div
                    key={task.id}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                    className={`h-[52px] px-3.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isHovered
                        ? 'bg-[#27272a]/60'
                        : selectedTaskId === task.id
                        ? 'bg-[#6366f1]/10'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(task.id);
                        }}
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-none ${
                          isDone
                            ? 'bg-[#10b981] border-[#10b981] text-[#09090b]'
                            : 'border-[#3f3f46] hover:border-[#6366f1]'
                        }`}
                        title={isDone ? 'Вернуть в работу' : 'Отметить выполненной'}
                      >
                        {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] flex-none">
                            {task.project}
                          </span>
                          <span
                            className={`text-xs font-medium truncate ${
                              isDone
                                ? 'line-through text-[#71717a]'
                                : overdue
                                ? 'text-[#fafafa]'
                                : 'text-[#e4e4e7]'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        {/* Subline: Blocker badges */}
                        <div className="flex items-center gap-2 text-[10px] text-[#71717a] mt-0.5">
                          {task.overdueBlockerCount > 0 ? (
                            <span className="text-[#f43f5e] font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {task.overdueBlockerCount} блокер(а) сорвано
                            </span>
                          ) : task.unresolvedBlockerCount > 0 ? (
                            <span className="text-[#818cf8] font-medium flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              ждёт {task.unresolvedBlockerCount} задач(и)
                            </span>
                          ) : task.hasBlockers ? (
                            <span className="text-[#10b981] font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              разблокирована
                            </span>
                          ) : (
                            <span>автономная</span>
                          )}

                          {task.isBlockerForOthers && (
                            <span className="text-amber-400 font-medium">· ключевой блокер</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Assignee & Due Date */}
                    <div className="flex items-center gap-2 flex-none">
                      <Avatar
                        name={userById(task.assignee)?.name || task.assignee}
                        size="xs"
                      />
                      <span
                        className={`text-[11px] font-mono ${
                          overdue ? 'text-[#f43f5e] font-semibold' : 'text-[#a1a1aa]'
                        }`}
                      >
                        {fmtRu(task.due)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Scrollable Gantt Canvas */}
          <div
            ref={timelineScrollRef}
            className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#09090b]/80"
          >
            <div
              style={{ width: totalTimelineWidth, minHeight: '100%' }}
              className="relative select-none"
            >
              {/* Timeline Header (Days & Dates) */}
              <div className="h-12 border-b border-[#27272a] sticky top-0 bg-[#18181b] z-10 flex">
                {daysRange.map((col) => (
                  <div
                    key={col.offset}
                    style={{ width: dayWidth }}
                    className={`h-full border-r border-[#27272a]/50 flex flex-col items-center justify-center text-[10px] flex-none relative ${
                      col.isToday
                        ? 'bg-rose-500/10 font-bold text-[#f43f5e]'
                        : 'text-[#71717a]'
                    }`}
                  >
                    <span className="font-mono">{col.label}</span>
                    <span className="text-[9px] text-[#52525b] mt-0.5">{col.dateStr}</span>

                    {/* Highlight badge for Today */}
                    {col.isToday && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-[#f43f5e] text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                        Сегодня
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Background Grid Vertical Day Columns */}
              <div
                className="absolute top-12 left-0 right-0 bottom-0 pointer-events-none flex"
                style={{ height: ganttTasks.length * ROW_HEIGHT }}
              >
                {daysRange.map((col) => (
                  <div
                    key={`col-${col.offset}`}
                    style={{ width: dayWidth }}
                    className={`h-full border-r border-[#27272a]/20 flex-none relative ${
                      col.isToday ? 'bg-rose-500/[0.04]' : ''
                    }`}
                  >
                    {/* Vertical Red Marker Line for Today */}
                    {col.isToday && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-[#f43f5e]/50 border-r border-dashed border-[#f43f5e]/80" />
                    )}
                  </div>
                ))}
              </div>

              {/* SVG Layer: Visual Connection Lines Between Tasks */}
              <svg
                className="absolute top-12 left-0 pointer-events-none z-10"
                style={{
                  width: totalTimelineWidth,
                  height: ganttTasks.length * ROW_HEIGHT
                }}
              >
                <defs>
                  {/* Arrowhead markers */}
                  <marker
                    id="arrow-resolved"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#818cf8" />
                  </marker>
                  <marker
                    id="arrow-critical"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                  <marker
                    id="arrow-highlighted"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#fafafa" />
                  </marker>
                </defs>

                {dependencyLinks.map((link) => {
                  const isHighlighted =
                    hoveredLinkId === link.id ||
                    hoveredTaskId === link.fromId ||
                    hoveredTaskId === link.toId;

                  let strokeColor = '#818cf8';
                  let markerEnd = 'url(#arrow-active)';
                  let strokeWidth = isHighlighted ? 2.5 : 1.75;
                  let strokeDasharray = 'none';

                  if (link.status === 'resolved') {
                    strokeColor = '#10b981';
                    markerEnd = 'url(#arrow-resolved)';
                  } else if (link.status === 'critical') {
                    strokeColor = '#f43f5e';
                    markerEnd = 'url(#arrow-critical)';
                    strokeWidth = isHighlighted ? 3 : 2;
                    strokeDasharray = '4,3';
                  }

                  if (isHighlighted) {
                    strokeColor = link.status === 'critical' ? '#f43f5e' : '#fafafa';
                    markerEnd =
                      link.status === 'critical'
                        ? 'url(#arrow-critical)'
                        : 'url(#arrow-highlighted)';
                  }

                  return (
                    <g key={link.id} className="cursor-pointer pointer-events-auto">
                      {/* Invisible wider hit-target for hover */}
                      <path
                        d={link.pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        onMouseEnter={() => setHoveredLinkId(link.id)}
                        onMouseLeave={() => setHoveredLinkId(null)}
                      />

                      {/* Visible dependency path */}
                      <path
                        d={link.pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        markerEnd={markerEnd}
                        className="transition-all duration-150"
                        onMouseEnter={() => setHoveredLinkId(link.id)}
                        onMouseLeave={() => setHoveredLinkId(null)}
                      />

                      {/* Start circle anchor on predecessor bar */}
                      <circle
                        cx={link.startX}
                        cy={link.startY}
                        r={isHighlighted ? 4 : 2.5}
                        fill={strokeColor}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Task Gantt Bars Layer */}
              <div className="absolute top-12 left-0 right-0 z-20">
                {ganttTasks.map((task) => {
                  const leftPos = (task.startDay - minDay) * dayWidth;
                  const barWidth = Math.max(task.duration * dayWidth, 32);
                  const topPos = task.rowIndex * ROW_HEIGHT + 10;
                  const isDone = task.status === 'done';
                  const overdue = isOverdue(task);
                  const isHovered =
                    hoveredTaskId === task.id ||
                    dependencyLinks.some(
                      (l) =>
                        l.id === hoveredLinkId &&
                        (l.fromId === task.id || l.toId === task.id)
                    );

                  // Bar color styling
                  let barBg = 'bg-[#6366f1] text-white border-[#818cf8]';
                  if (isDone) {
                    barBg = 'bg-[#10b981]/20 text-[#34d399] border-[#10b981]/50';
                  } else if (overdue) {
                    barBg = 'bg-[#f43f5e]/25 text-[#f43f5e] border-[#f43f5e]/60';
                  } else if (task.status === 'todo') {
                    barBg = 'bg-[#27272a] text-[#d4d4d8] border-[#3f3f46]';
                  }

                  return (
                    <div
                      key={task.id}
                      style={{
                        position: 'absolute',
                        left: leftPos,
                        top: topPos,
                        width: barWidth,
                        height: 32
                      }}
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      onClick={() => onCycleTask(task.id)}
                      className={`rounded-lg border px-2.5 flex items-center justify-between gap-1.5 shadow-sm transition-all cursor-pointer select-none group ${barBg} ${
                        isHovered ? 'ring-2 ring-white/60 z-30 scale-[1.02]' : ''
                      }`}
                      title={`${task.title} (Кликните для смены статуса)`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        {/* Status Icon */}
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399] flex-none" />
                        ) : overdue ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#f43f5e] flex-none animate-pulse" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-current opacity-75 flex-none" />
                        )}

                        <span className="text-[11px] font-medium truncate">
                          {task.title}
                        </span>
                      </div>

                      {/* Right bar info (duration badge) */}
                      <div className="flex items-center gap-1 flex-none opacity-80 group-hover:opacity-100 text-[10px] font-mono">
                        <span>{task.duration}д</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Guidance Bar */}
        <div className="p-3 border-t border-[#27272a] bg-[#18181b] flex items-center justify-between flex-wrap gap-2 text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#6366f1] flex-none" />
            <span>
              Наведите курсор на стрелку связи или задачу для подсветки цепочки. Кликните по полосе задачи для переключения статуса.
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span>Всего задач в плане: <strong className="text-[#fafafa] font-mono">{ganttTasks.length}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
