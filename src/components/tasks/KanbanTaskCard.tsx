import React, { useState } from 'react';
import {
  Check,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  ListChecks,
  Plus,
  Trash2,
  Zap,
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Task } from '../../types';
import { Avatar } from '../common/Avatar';
import { fmtRu, daysLeft } from '../../data/seedData';
import { useApp } from '../../context/AppContext';

export const PRIORITY_CONFIG = {
  high: { label: 'Высокий', color: 'bg-[#f43f5e]', badge: 'text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/25' },
  med: { label: 'Средний', color: 'bg-[#f59e0b]', badge: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/25' },
  low: { label: 'Низкий', color: 'bg-[#71717a]', badge: 'text-[#a1a1aa] bg-zinc-800 border-zinc-700' }
};

interface KanbanTaskCardProps {
  task: Task;
  index: number;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent, targetTask: Task, position: 'before' | 'after') => void;
}

export const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({
  task,
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onCardDrop
}) => {
  const {
    toggleTask,
    moveTask,
    userById,
    projLabel,
    isOverdue,
    flashId,
    toggleSubtask,
    addSubtask,
    deleteSubtask,
    runRulesEngine
  } = useApp();

  const [dropIndicator, setDropIndicator] = useState<'before' | 'after' | null>(null);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const assignee = userById(task.assignee);
  const dl = daysLeft(task.due);
  const isOver = isOverdue(task);
  const isDone = task.status === 'done';
  const isFlashed = flashId === `task-${task.id}`;

  const subtasks = task.subtasks || [];
  const subtasksTotal = subtasks.length;
  const subtasksDone = subtasks.filter((s) => s.done).length;
  const subtasksPercent = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;

  // Column transitions
  const canMoveLeft = task.status === 'inwork' || task.status === 'done';
  const canMoveRight = task.status === 'todo' || task.status === 'inwork';

  const handleMoveLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'done') moveTask(task.id, 'inwork');
    else if (task.status === 'inwork') moveTask(task.id, 'todo');
  };

  const handleMoveRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'todo') moveTask(task.id, 'inwork');
    else if (task.status === 'inwork') moveTask(task.id, 'done');
  };

  const handleAddSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newSubtaskTitle.trim()) return;
    addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      setDropIndicator('before');
    } else {
      setDropIndicator('after');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDropIndicator(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const position = dropIndicator || 'before';
    setDropIndicator(null);
    onCardDrop(e, task, position);
  };

  return (
    <div className="relative group/card select-none">
      {/* Insertion line indicator above */}
      {dropIndicator === 'before' && (
        <div className="h-1 -mt-1 mb-1.5 rounded-full bg-[#6366f1] shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse" />
      )}

      <div
        id={`task-${task.id}`}
        draggable
        onDragStart={(e) => onDragStart(e, task)}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-[#18181b] border rounded-xl p-3.5 transition-all duration-150 cursor-grab active:cursor-grabbing hover:border-[#3f3f46] hover:shadow-md ${
          isDragging
            ? 'opacity-35 scale-[0.98] border-dashed border-[#6366f1] bg-[#6366f1]/5 shadow-none'
            : isDone
            ? 'border-[#27272a] opacity-75 bg-[#141416]'
            : 'border-[#27272a] shadow-xs'
        } ${isFlashed ? 'animate-flash' : ''}`}
      >
        {/* Card Header: Drag Grip, Project Badge, Priority Pill */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[#71717a] group-hover/card:text-[#a1a1aa] transition-colors p-0.5"
              title="Потяните карточку для перемещения между колонками"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>

            {/* Project Tag */}
            <span className="text-[11px] font-medium font-mono px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa] truncate max-w-[140px]">
              {projLabel(task.project).split(' · ')[0]}
            </span>
          </div>

          {/* Priority Badge */}
          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-md border flex-none ${
              PRIORITY_CONFIG[task.prio].badge
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                PRIORITY_CONFIG[task.prio].color
              }`}
            />
            {PRIORITY_CONFIG[task.prio].label}
          </span>
        </div>

        {/* Task Title with Checkbox */}
        <div className="flex items-start gap-2.5 my-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(task.id);
            }}
            className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors flex-none cursor-pointer ${
              isDone
                ? 'bg-[#10b981] border-[#10b981] text-[#09090b]'
                : 'border-[#3f3f46] hover:border-[#6366f1]'
            }`}
            aria-label="Отметить выполненной"
            title={isDone ? 'Вернуть в работу' : 'Отметить как выполненную'}
          >
            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
          </button>

          <div
            className={`text-[13px] font-medium leading-snug break-words ${
              isDone ? 'line-through text-[#71717a]' : 'text-[#fafafa]'
            }`}
          >
            {task.title}
          </div>
        </div>

        {/* PM Overdue Notification Pill */}
        {task.notifiedPmOverdue && (
          <div className="mt-1.5 mb-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 font-medium">
            <Bell className="w-3 h-3 text-rose-400 flex-none" />
            <span className="truncate">РП оповещен о просрочке</span>
          </div>
        )}

        {/* Subtasks Section with Interactive Checklist & Automation Indicator */}
        <div className="mt-2">
          {subtasksTotal > 0 ? (
            <div className="space-y-1.5">
              {/* Subtasks Toggle & Progress Bar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubtasks(!showSubtasks);
                }}
                className="w-full flex items-center justify-between text-[11px] text-[#a1a1aa] hover:text-[#fafafa] transition-colors py-0.5 cursor-pointer group/st"
              >
                <div className="flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-medium">Чеклист: {subtasksDone}/{subtasksTotal}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">({subtasksPercent}%)</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 group-hover/st:text-zinc-300">
                  <span>{showSubtasks ? 'Скрыть' : 'Раскрыть'}</span>
                  {showSubtasks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </button>

              {/* Progress Bar */}
              <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    subtasksDone === subtasksTotal ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${subtasksPercent}%` }}
                />
              </div>

              {/* Collapsible Subtasks List */}
              {showSubtasks && (
                <div className="pt-2 pb-1 space-y-1.5 border-t border-zinc-800/80">
                  {subtasks.map((st) => (
                    <div
                      key={st.id}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-between gap-2 group/item px-1.5 py-1 rounded hover:bg-zinc-800/50 transition-colors"
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubtask(task.id, st.id);
                          }}
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors flex-none cursor-pointer ${
                            st.done
                              ? 'bg-emerald-500 border-emerald-500 text-black'
                              : 'border-zinc-600 hover:border-indigo-400 bg-zinc-900'
                          }`}
                          title={st.done ? 'Снять отметку' : 'Отметить выполненной'}
                        >
                          {st.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                        <span
                          className={`text-xs break-words select-text ${
                            st.done ? 'line-through text-zinc-500' : 'text-zinc-300'
                          }`}
                        >
                          {st.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSubtask(task.id, st.id);
                        }}
                        className="opacity-0 group-hover/item:opacity-100 text-zinc-500 hover:text-rose-400 p-0.5 transition-opacity cursor-pointer"
                        title="Удалить пункт"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add Subtask Form */}
                  <form onSubmit={handleAddSubtaskSubmit} className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Добавить подзадачу..."
                      className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newSubtaskTitle.trim()}
                      className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
                      title="Добавить"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div>
              {showSubtasks ? (
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500">Чеклист пуст</div>
                  <form onSubmit={handleAddSubtaskSubmit} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Новая подзадача..."
                      className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newSubtaskTitle.trim()}
                      className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </form>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubtasks(true);
                  }}
                  className="text-[11px] text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer py-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить чеклист</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card Footer: Due Date, Assignee, Quick Move Controls */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#27272a]/70">
          {/* Due date */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md border ${
                isOver
                  ? 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/30 font-semibold'
                  : dl === 0
                  ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 font-semibold'
                  : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a]'
              }`}
            >
              {isOver ? (
                <AlertTriangle className="w-3 h-3 text-[#f43f5e]" />
              ) : (
                <Clock className="w-3 h-3 text-[#71717a]" />
              )}
              <span>{fmtRu(task.due)}</span>
              {isOver && <span>· -{Math.abs(dl)}д</span>}
              {dl === 0 && <span>· сегодня</span>}
            </span>
          </div>

          {/* Assignee and Quick-move column buttons */}
          <div className="flex items-center gap-1.5">
            {assignee && (
              <span title={assignee.name} className="flex items-center">
                <Avatar name={assignee.name} size="sm" />
              </span>
            )}

            {/* Quick Move Arrows for Touch / Accessibility */}
            <div className="flex items-center gap-0.5 bg-[#09090b] border border-[#27272a] rounded-md p-0.5">
              <button
                type="button"
                disabled={!canMoveLeft}
                onClick={handleMoveLeft}
                className={`p-1 rounded text-[#71717a] transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
                  canMoveLeft ? 'hover:text-[#fafafa] hover:bg-white/10' : ''
                }`}
                title={
                  task.status === 'done'
                    ? 'Переместить назад в «В работе»'
                    : 'Переместить назад в «К выполнению»'
                }
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={!canMoveRight}
                onClick={handleMoveRight}
                className={`p-1 rounded text-[#71717a] transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
                  canMoveRight ? 'hover:text-[#fafafa] hover:bg-white/10' : ''
                }`}
                title={
                  task.status === 'todo'
                    ? 'Переместить вперед в «В работе»'
                    : 'Переместить вперед в «Выполнено»'
                }
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Insertion line indicator below */}
      {dropIndicator === 'after' && (
        <div className="h-1 mt-1.5 -mb-1 rounded-full bg-[#6366f1] shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse" />
      )}
    </div>
  );
};
