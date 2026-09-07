import React, { useState } from 'react';
import {
  Plus,
  Check,
  LayoutGrid,
  ListFilter,
  Search,
  X,
  AlertTriangle,
  GripVertical,
  CheckCircle2,
  ListTodo,
  Clock,
  ArrowRight,
  Download,
  CalendarRange,
  Link2,
  Trash2,
  Zap,
  Bell,
  ListChecks
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { fmtRu, daysLeft } from '../../data/seedData';
import { Task } from '../../types';
import { KanbanColumn, ColumnDefinition } from '../tasks/KanbanColumn';
import { PRIORITY_CONFIG } from '../tasks/KanbanTaskCard';
import { exportTasksToCsv } from '../../utils/exportCsv';
import { TasksGanttChart } from '../tasks/TasksGanttChart';
import { AutomationRulesModal } from '../tasks/AutomationRulesModal';

const COLUMNS: ColumnDefinition[] = [
  {
    id: 'todo',
    title: 'К выполнению',
    subtitle: 'Очередь задач по проектам',
    dotColor: 'bg-zinc-400',
    badgeStyle: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    accentBorder: 'border-zinc-500'
  },
  {
    id: 'inwork',
    title: 'В работе',
    subtitle: 'В процессе выполнения',
    dotColor: 'bg-[#6366f1]',
    badgeStyle: 'bg-[#6366f1]/20 text-[#818cf8] border-[#6366f1]/40',
    accentBorder: 'border-[#6366f1]'
  },
  {
    id: 'done',
    title: 'Выполнено',
    subtitle: 'Проверено и завершено',
    dotColor: 'bg-[#10b981]',
    badgeStyle: 'bg-[#10b981]/20 text-[#34d399] border-[#10b981]/40',
    accentBorder: 'border-[#10b981]'
  }
];

export const TasksView: React.FC = () => {
  const {
    state,
    taskFilter,
    setTaskFilter,
    toggleTask,
    cycleTask,
    moveTask,
    deleteTask,
    setIsModalOpen,
    userById,
    projLabel,
    isOverdue,
    flashId,
    isRulesModalOpen,
    setIsRulesModalOpen,
    toggleSubtask,
    addSubtask,
    deleteSubtask,
    runRulesEngine
  } = useApp();

  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'gantt'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'med' | 'low'>('all');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(null);

  const activeRulesCount = (state.automationRules || []).filter((r) => r.enabled).length;

  const statusChips = [
    { key: 'open', label: 'Открытые' },
    { key: 'inwork', label: 'В работе' },
    { key: 'overdue', label: 'Просроченные' },
    { key: 'done', label: 'Готовые' },
    { key: 'all', label: 'Все' }
  ];

  // Base filter matching function
  const matchesFilter = (task: Task, ignoreStatus: boolean = false) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = task.title.toLowerCase().includes(q);
      const projMatch = projLabel(task.project).toLowerCase().includes(q);
      const assigneeName = userById(task.assignee)?.name.toLowerCase() || '';
      const assigneeMatch = assigneeName.includes(q);
      if (!titleMatch && !projMatch && !assigneeMatch) return false;
    }

    // Project filter
    if (taskFilter.project !== 'all' && task.project !== taskFilter.project) {
      return false;
    }

    // Assignee filter
    if (taskFilter.assignee !== 'all' && task.assignee !== taskFilter.assignee) {
      return false;
    }

    // Priority filter
    if (priorityFilter !== 'all' && task.prio !== priorityFilter) {
      return false;
    }

    // Status filter (only applied in list view or if not ignored)
    if (!ignoreStatus) {
      if (taskFilter.status === 'open') return task.status !== 'done';
      if (taskFilter.status === 'inwork') return task.status === 'inwork';
      if (taskFilter.status === 'overdue') return isOverdue(task);
      if (taskFilter.status === 'done') return task.status === 'done';
    }

    return true;
  };

  // Filtered tasks for list view
  const filteredListTasks = state.tasks
    .filter((t) => matchesFilter(t, false))
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return daysLeft(a.due) - daysLeft(b.due);
    });

  // Filtered tasks per column for Kanban
  const getTasksForColumn = (columnId: Task['status']) => {
    return state.tasks
      .filter((t) => t.status === columnId && matchesFilter(t, true))
      .sort((a, b) => daysLeft(a.due) - daysLeft(b.due));
  };

  // Drag and drop handlers
  const handleCardDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleCardDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, columnId: Task['status']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleColumnDragEnter = (e: React.DragEvent, columnId: Task['status']) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleColumnDragLeave = (e: React.DragEvent, columnId: Task['status']) => {
    e.preventDefault();
    // Only reset if left the element entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverColumn === columnId) {
        setDragOverColumn(null);
      }
    }
  };

  const handleColumnDrop = (e: React.DragEvent, columnId: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      moveTask(taskId, columnId);
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleCardDrop = (
    e: React.DragEvent,
    columnId: Task['status'],
    targetTask: Task,
    position: 'before' | 'after'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      const colTasks = state.tasks.filter((t) => t.status === columnId);
      const targetIndex = colTasks.findIndex((t) => t.id === targetTask.id);
      const finalIndex =
        targetIndex !== -1
          ? position === 'after'
            ? targetIndex + 1
            : targetIndex
          : 0;

      moveTask(taskId, columnId, finalIndex);
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  // Column quick add trigger
  const handleQuickAdd = (_columnId: Task['status']) => {
    setIsModalOpen(true);
  };

  // Stats calculation
  const totalTasks = state.tasks.length;
  const todoTasks = state.tasks.filter((t) => t.status === 'todo').length;
  const inworkTasks = state.tasks.filter((t) => t.status === 'inwork').length;
  const doneTasks = state.tasks.filter((t) => t.status === 'done').length;
  const overdueTasks = state.tasks.filter(isOverdue).length;

  const getCycleButtonText = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return 'в очередь';
      case 'inwork':
        return 'в работе';
      case 'done':
        return 'готово';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header & Mode Switcher */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
              Задачи
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] font-medium">
              {totalTasks} задач
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-1 flex items-center gap-1.5 flex-wrap">
            {viewMode === 'gantt' ? (
              <>
                <span>Диаграмма Ганта с интерактивными линиями связей, блокерами и последовательностями</span>
                <span className="text-[#6366f1] inline-flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> граф зависимостей
                </span>
              </>
            ) : viewMode === 'kanban' ? (
              <>
                <span>Перетаскивайте карточки между статусами «К выполнению», «В работе» и «Выполнено»</span>
                <span className="text-[#6366f1] inline-flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> drag-and-drop
                </span>
              </>
            ) : (
              <>
                <span>Табличный список задач с возможностью фильтрации и быстрого переключения статуса</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle: Kanban vs List vs Gantt */}
          <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'kanban'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              title="Отображать колонки статусов (Drag & Drop)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Доска</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              title="Отображать компактный список"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Список</span>
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'gantt'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              title="Диаграмма Ганта со связями зависимостей и блокерами"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Гант (Связи)</span>
            </button>
          </div>

          {/* Export to CSV Button */}
          <button
            type="button"
            onClick={() => {
              const tasksToExport =
                viewMode === 'list'
                  ? filteredListTasks
                  : state.tasks.filter((t) => matchesFilter(t, true));
              exportTasksToCsv(tasksToExport, projLabel, userById);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#27272a] bg-[#18181b] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] hover:bg-[#27272a]/50 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Экспортировать текущий список задач в формате CSV (Excel)"
          >
            <Download className="w-3.5 h-3.5 text-[#6366f1]" />
            <span>Экспорт CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-[13px] bg-[#6366f1] text-white hover:bg-[#4f46e5] active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Новая задача</span>
          </button>
        </div>
      </div>

      {/* Quick Stat Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Очередь (Todo)</div>
            <div className="text-xl font-bold text-[#fafafa] font-mono mt-0.5">{todoTasks}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
            <ListTodo className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">В работе (In Work)</div>
            <div className="text-xl font-bold text-[#818cf8] font-mono mt-0.5">{inworkTasks}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 flex items-center justify-center text-[#818cf8]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Выполнено (Done)</div>
            <div className="text-xl font-bold text-[#34d399] font-mono mt-0.5">{doneTasks}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#34d399]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#71717a] font-medium">Просрочено</div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${overdueTasks > 0 ? 'text-[#f43f5e]' : 'text-[#71717a]'}`}>
              {overdueTasks}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#f43f5e]/15 border border-[#f43f5e]/30 flex items-center justify-center text-[#f43f5e]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-[#18181b]/60 border border-[#27272a] rounded-xl p-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию задачи, проекту или исполнителю..."
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

        {/* Project Select */}
        <select
          value={taskFilter.project}
          onChange={(e) =>
            setTaskFilter((prev) => ({ ...prev, project: e.target.value }))
          }
          className="px-3 py-1.5 bg-[#09090b] border border-[#27272a] rounded-lg text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1] cursor-pointer"
        >
          <option value="all" className="bg-[#18181b]">
            Все проекты
          </option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#18181b]">
              {p.id} · {p.title}
            </option>
          ))}
          <option value="base" className="bg-[#18181b]">
            Склад / база
          </option>
        </select>

        {/* Assignee Select */}
        <select
          value={taskFilter.assignee}
          onChange={(e) =>
            setTaskFilter((prev) => ({ ...prev, assignee: e.target.value }))
          }
          className="px-3 py-1.5 bg-[#09090b] border border-[#27272a] rounded-lg text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1] cursor-pointer"
        >
          <option value="all" className="bg-[#18181b]">
            Все сотрудники
          </option>
          {state.team.map((u) => (
            <option key={u.id} value={u.id} className="bg-[#18181b]">
              {u.name}
            </option>
          ))}
        </select>

        {/* Priority Select */}
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as 'all' | 'high' | 'med' | 'low')
          }
          className="px-3 py-1.5 bg-[#09090b] border border-[#27272a] rounded-lg text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1] cursor-pointer"
        >
          <option value="all" className="bg-[#18181b]">
            Все приоритеты
          </option>
          <option value="high" className="bg-[#18181b]">
            Высокий
          </option>
          <option value="med" className="bg-[#18181b]">
            Средний
          </option>
          <option value="low" className="bg-[#18181b]">
            Низкий
          </option>
        </select>

        {/* Status Filter Pills (Only shown in List View) */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {statusChips.map((chip) => {
              const isActive = taskFilter.status === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() =>
                    setTaskFilter((prev) => ({ ...prev, status: chip.key }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#6366f1] text-white shadow-sm'
                      : 'border border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main View Display: Kanban Columns vs. Gantt View vs. Table List */}
      {viewMode === 'gantt' ? (
        /* Tasks Gantt View with Interactive Dependency Connection Lines */
        <TasksGanttChart
          tasks={state.tasks.filter((t) => matchesFilter(t, true))}
          onToggleTask={toggleTask}
          onCycleTask={cycleTask}
          userById={userById}
          projLabel={projLabel}
          isOverdue={isOverdue}
        />
      ) : viewMode === 'kanban' ? (
        /* Kanban Board with 3 Status Columns */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5 items-start">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getTasksForColumn(column.id)}
              draggedTaskId={draggedTaskId}
              isDragOver={dragOverColumn === column.id}
              onDragOver={handleColumnDragOver}
              onDragEnter={handleColumnDragEnter}
              onDragLeave={handleColumnDragLeave}
              onDrop={handleColumnDrop}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onCardDrop={handleCardDrop}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      ) : (
        /* Flat List View (fallback / compact mode) */
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden divide-y divide-[#27272a] shadow-sm">
          {filteredListTasks.length === 0 ? (
            <div className="p-12 text-center text-[#a1a1aa] text-sm">
              Задач по выбранному фильтру нет 🎉
            </div>
          ) : (
            filteredListTasks.map((task) => {
              const assignee = userById(task.assignee);
              const dl = daysLeft(task.due);
              const isOver = isOverdue(task);
              const isDone = task.status === 'done';
              const isFlashed = flashId === `task-${task.id}`;

              return (
                <div
                  key={task.id}
                  id={`task-${task.id}`}
                  className={`flex items-start gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${
                    isDone ? 'opacity-65' : ''
                  } ${isFlashed ? 'animate-flash' : ''}`}
                >
                  {/* Grip hint */}
                  <span className="text-[#71717a] pt-1" title="Задачи можно распределять на Канбан-доске">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>

                  {/* Complete checkbox */}
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-colors flex-none cursor-pointer ${
                      isDone
                        ? 'bg-[#10b981] border-[#10b981] text-[#09090b]'
                        : 'border-[#3f3f46] hover:border-[#6366f1]'
                    }`}
                    aria-label="Отметить выполненной"
                  >
                    {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[13.5px] font-medium leading-snug ${
                        isDone ? 'line-through text-[#71717a]' : 'text-[#fafafa]'
                      }`}
                    >
                      {task.title}
                    </div>

                    {/* Metadata Chips */}
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {/* Priority */}
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            PRIORITY_CONFIG[task.prio].color
                          }`}
                        />
                        {PRIORITY_CONFIG[task.prio].label}
                      </span>

                      {/* Due Date */}
                      <span
                        className={`font-mono text-[11px] px-2 py-0.5 rounded-md border ${
                          isOver
                            ? 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25 font-semibold'
                            : dl === 0
                            ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25 font-semibold'
                            : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a]'
                        }`}
                      >
                        {fmtRu(task.due)}
                        {isOver && ` · просрочено ${Math.abs(dl)} дн`}
                        {dl === 0 && ' · сегодня'}
                      </span>

                      {/* Project */}
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa]">
                        {projLabel(task.project).split(' · ')[0]}
                      </span>

                      {/* Assignee */}
                      {assignee && (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#a1a1aa]">
                          <Avatar name={assignee.name} size="sm" />
                          <span>{assignee.name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Status Cycle Button & Delete */}
                  <div className="flex items-center gap-1.5 flex-none">
                    <button
                      onClick={() => cycleTask(task.id)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                        task.status === 'inwork'
                          ? 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/30'
                          : task.status === 'done'
                          ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                          : 'border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                      }`}
                    >
                      {getCycleButtonText(task.status)}
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      title="Удалить задачу"
                      className="p-1 rounded-md text-[#71717a] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
