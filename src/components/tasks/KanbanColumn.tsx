import React from 'react';
import { Plus, ArrowDown, Sparkles } from 'lucide-react';
import { Task } from '../../types';
import { KanbanTaskCard } from './KanbanTaskCard';

export interface ColumnDefinition {
  id: Task['status'];
  title: string;
  subtitle: string;
  dotColor: string;
  badgeStyle: string;
  accentBorder: string;
}

interface KanbanColumnProps {
  column: ColumnDefinition;
  tasks: Task[];
  draggedTaskId: string | null;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent, columnId: Task['status']) => void;
  onDragEnter: (e: React.DragEvent, columnId: Task['status']) => void;
  onDragLeave: (e: React.DragEvent, columnId: Task['status']) => void;
  onDrop: (e: React.DragEvent, columnId: Task['status']) => void;
  onCardDragStart: (e: React.DragEvent, task: Task) => void;
  onCardDragEnd: (e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent, columnId: Task['status'], targetTask: Task, position: 'before' | 'after') => void;
  onQuickAdd: (columnId: Task['status']) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  draggedTaskId,
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  onCardDrop,
  onQuickAdd
}) => {
  return (
    <div
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragEnter={(e) => onDragEnter(e, column.id)}
      onDragLeave={(e) => onDragLeave(e, column.id)}
      onDrop={(e) => onDrop(e, column.id)}
      className={`flex flex-col bg-[#121214] border rounded-2xl overflow-hidden transition-all duration-200 min-h-[480px] shadow-sm ${
        isDragOver
          ? `ring-2 ring-[#6366f1]/60 ${column.accentBorder} bg-[#6366f1]/[0.04]`
          : 'border-[#27272a]/80 hover:border-[#3f3f46]'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#27272a] bg-[#18181b]/70 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[14px] text-[#fafafa] tracking-tight truncate">
                {column.title}
              </h3>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${column.badgeStyle}`}
              >
                {tasks.length}
              </span>
            </div>
            <p className="text-[11px] text-[#71717a] truncate">
              {column.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={() => onQuickAdd(column.id)}
          className="p-1.5 rounded-lg text-[#71717a] hover:text-[#fafafa] hover:bg-white/5 transition-colors cursor-pointer"
          title={`Добавить задачу в «${column.title}»`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Drop Alert / Banner while dragging over */}
      {isDragOver && draggedTaskId && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-[#6366f1]/15 border border-[#6366f1]/30 text-[#818cf8] text-xs font-medium flex items-center justify-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          <span>Отпустите для перемещения в «{column.title}»</span>
        </div>
      )}

      {/* Column Tasks Container */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[160px]">
        {tasks.length === 0 ? (
          <div
            className={`h-full min-h-[180px] flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl text-center transition-all ${
              isDragOver
                ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#fafafa]'
                : 'border-[#27272a] text-[#71717a] hover:border-[#3f3f46]'
            }`}
          >
            {isDragOver ? (
              <div className="flex flex-col items-center gap-1.5">
                <Sparkles className="w-6 h-6 text-[#6366f1] animate-pulse" />
                <span className="text-xs font-semibold text-[#818cf8]">
                  Бросьте задачу сюда
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs">В этой колонке нет задач</p>
                <button
                  type="button"
                  onClick={() => onQuickAdd(column.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#818cf8] hover:text-[#a5b4fc] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать первую</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          tasks.map((task, idx) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              index={idx}
              isDragging={draggedTaskId === task.id}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onCardDrop={(e, targetTask, position) =>
                onCardDrop(e, column.id, targetTask, position)
              }
            />
          ))
        )}
      </div>

      {/* Column Footer with Quick Add Bar */}
      <div className="p-2.5 border-t border-[#27272a]/60 bg-[#18181b]/30">
        <button
          type="button"
          onClick={() => onQuickAdd(column.id)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-[#71717a] hover:text-[#fafafa] hover:bg-white/5 border border-dashed border-[#27272a] hover:border-[#3f3f46] transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить в «{column.title}»</span>
        </button>
      </div>
    </div>
  );
};
