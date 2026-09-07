import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  CheckCircle2,
  Box,
  FolderKanban,
  FileText,
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  Send,
  Plus,
  Trash2,
  Wrench,
  Clock,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActivityItem, ActivityType } from '../types';
import { formatRelativeTime } from '../data/seedData';

interface ActivityFeedProps {
  variant?: 'card' | 'sidebar';
  maxHeight?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  variant = 'card',
  maxHeight = 'max-h-[460px]'
}) => {
  const {
    activities,
    addActivity,
    clearActivities,
    isLiveFeedActive,
    setIsLiveFeedActive,
    simulateFieldEvent,
    openProject,
    switchView,
    triggerFlash
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [quickNote, setQuickNote] = useState('');
  const [showQuickNoteInput, setShowQuickNoteInput] = useState(false);
  const [, setTick] = useState(0);

  // Force re-render periodically to update relative times ("только что", "2 мин назад")
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;

    addActivity({
      type: 'system',
      title: 'Оперативная отметка диспетчера',
      detail: quickNote.trim(),
      actor: 'Диспетчер (вы)',
      actorRole: 'Штаб',
      badgeType: 'info'
    });

    setQuickNote('');
    setShowQuickNoteInput(false);
  };

  const handleTargetClick = (target?: ActivityItem['target']) => {
    if (!target) return;
    if (target.type === 'project') {
      openProject(target.id);
      triggerFlash(`proj-${target.id}`);
    } else if (target.type === 'equipment') {
      switchView('equipment');
      triggerFlash(`eq-${target.id}`);
    } else if (target.type === 'task') {
      switchView('tasks');
      triggerFlash(`task-${target.id}`);
    } else if (target.type === 'team') {
      switchView('team');
      triggerFlash(`team-${target.id}`);
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'task') return act.type === 'task';
    if (activeFilter === 'equipment') return act.type === 'equipment';
    if (activeFilter === 'project') return act.type === 'project';
    if (activeFilter === 'system') return act.type === 'system' || act.type === 'doc';
    return true;
  });

  const getTypeIcon = (type: ActivityType, badgeType: string) => {
    switch (type) {
      case 'task':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />;
      case 'equipment':
        return badgeType === 'crit' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-[#f43f5e]" />
        ) : (
          <Wrench className="w-3.5 h-3.5 text-[#6366f1]" />
        );
      case 'project':
        return <FolderKanban className="w-3.5 h-3.5 text-[#8b5cf6]" />;
      case 'doc':
        return <FileText className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'system':
      default:
        return badgeType === 'warn' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
        ) : (
          <Activity className="w-3.5 h-3.5 text-[#06b6d4]" />
        );
    }
  };

  const getBadgeStyle = (badgeType: string) => {
    switch (badgeType) {
      case 'ok':
        return 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25';
      case 'warn':
        return 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25';
      case 'crit':
        return 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25';
      case 'info':
      default:
        return 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/25';
    }
  };

  return (
    <div
      className={`bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all duration-200 ${
        variant === 'sidebar' ? 'h-full' : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[#27272a] bg-[#18181b]/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center justify-center text-[#6366f1] shadow-inner">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[14px] text-[#fafafa] tracking-tight">
                Оперативная лента активности
              </h3>
              {/* Pulsing Live indicator */}
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                  isLiveFeedActive
                    ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/25'
                    : 'bg-[#27272a] text-[#71717a] border-[#3f3f46]'
                }`}
                title={isLiveFeedActive ? 'Авто-обновления активны' : 'Авто-обновления на паузе'}
              >
                {isLiveFeedActive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
                  </span>
                )}
                <span>{isLiveFeedActive ? 'LIVE' : 'ПАУЗА'}</span>
              </div>
            </div>
            <p className="text-[11px] text-[#71717a]">
              Фиксация действий команды, статусов парка и событий с площадок в реальном времени
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setIsLiveFeedActive((prev) => !prev)}
            className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              isLiveFeedActive
                ? 'border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                : 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]'
            }`}
            title={isLiveFeedActive ? 'Приостановить живой поток' : 'Возобновить живой поток'}
            aria-label="Переключить live режим"
          >
            {isLiveFeedActive ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Пауза</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">В эфир</span>
              </>
            )}
          </button>

          <button
            onClick={simulateFieldEvent}
            className="px-2.5 py-1.5 rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 hover:bg-[#6366f1]/20 text-[#818cf8] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Смоделировать входящий рапорт с площадки или датчика"
          >
            <Sparkles className="w-3 h-3 text-[#a5b4fc]" />
            <span>Тест сигнала</span>
          </button>

          <button
            onClick={() => setShowQuickNoteInput((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg border border-[#27272a] bg-[#09090b] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Быстро внести диспетчерскую заметку"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Отметка</span>
          </button>

          {activities.length > 0 && (
            <button
              onClick={clearActivities}
              className="p-1.5 rounded-lg border border-transparent hover:border-[#27272a] text-[#71717a] hover:text-[#f43f5e] transition-colors cursor-pointer"
              title="Очистить ленту"
              aria-label="Очистить ленту"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Note Input Bar (collapsible) */}
      {showQuickNoteInput && (
        <form
          onSubmit={handleQuickNoteSubmit}
          className="px-5 py-3 border-b border-[#27272a] bg-[#09090b]/80 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <input
            type="text"
            autoFocus
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Ввести оперативную отметку (напр.: генераторы запущены, питание в норме)..."
            className="flex-1 px-3 py-1.5 text-xs bg-[#18181b] border border-[#27272a] rounded-lg text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#6366f1]"
          />
          <button
            type="submit"
            disabled={!quickNote.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#6366f1] text-white text-xs font-medium hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Записать</span>
          </button>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-5 py-2.5 border-b border-[#27272a] bg-[#09090b]/40 overflow-x-auto scrollbar-none text-[11px]">
        {[
          { id: 'all', label: 'Все события', count: activities.length },
          { id: 'task', label: 'Задачи', count: activities.filter((a) => a.type === 'task').length },
          { id: 'equipment', label: 'Склад & ТО', count: activities.filter((a) => a.type === 'equipment').length },
          { id: 'project', label: 'Проекты', count: activities.filter((a) => a.type === 'project').length },
          { id: 'system', label: 'Система & Документы', count: activities.filter((a) => a.type === 'system' || a.type === 'doc').length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-2.5 py-1 rounded-md font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeFilter === tab.id
                ? 'bg-[#18181b] text-[#fafafa] border border-[#3f3f46] shadow-xs'
                : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.02]'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFilter === tab.id
                  ? 'bg-[#6366f1]/20 text-[#818cf8]'
                  : 'bg-[#27272a] text-[#71717a]'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Feed List Container */}
      <div
        className={`divide-y divide-[#27272a] overflow-y-auto ${maxHeight} scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent flex-1`}
      >
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Activity className="w-8 h-8 text-[#3f3f46] mx-auto opacity-50" />
            <div className="text-xs font-medium text-[#a1a1aa]">
              Событий в этой категории пока нет
            </div>
            <div className="text-[11px] text-[#71717a]">
              Новые действия команды и системные рапорты отображаются здесь в реальном времени.
            </div>
          </div>
        ) : (
          filteredActivities.map((act) => {
            const isUserAction = act.actor.includes('вы') || act.actor.includes('Диспетчер');

            return (
              <div
                key={act.id}
                className="px-5 py-3 hover:bg-white/[0.02] transition-colors group flex items-start gap-3"
              >
                {/* Type Icon container */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-none mt-0.5 border ${getBadgeStyle(
                    act.badgeType
                  )}`}
                >
                  {getTypeIcon(act.type, act.badgeType)}
                </div>

                {/* Content body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span
                        className={`text-[12px] font-semibold truncate ${
                          isUserAction ? 'text-[#818cf8]' : 'text-[#fafafa]'
                        }`}
                      >
                        {act.actor}
                      </span>
                      {act.actorRole && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#09090b] border border-[#27272a] text-[#71717a]">
                          {act.actorRole}
                        </span>
                      )}
                    </div>

                    {/* Relative Time */}
                    <div className="flex items-center gap-1 text-[11px] text-[#71717a] flex-none font-mono">
                      <Clock className="w-3 h-3 opacity-60" />
                      <span>{formatRelativeTime(act.timestamp)}</span>
                    </div>
                  </div>

                  {/* Title & Details */}
                  <div className="mt-0.5">
                    <div className="text-[12.5px] font-medium text-[#fafafa] leading-snug">
                      {act.title}
                    </div>
                    {act.detail && (
                      <div className="text-[11.5px] text-[#a1a1aa] mt-0.5 leading-relaxed break-words">
                        {act.detail}
                      </div>
                    )}
                  </div>

                  {/* Optional Target Link */}
                  {act.target && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => handleTargetClick(act.target)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#6366f1] hover:text-[#818cf8] font-medium hover:underline cursor-pointer group/link"
                      >
                        <span>
                          {act.target.type === 'project' && `Открыть карточку ${act.target.id}`}
                          {act.target.type === 'equipment' && 'Перейти к оборудованию'}
                          {act.target.type === 'task' && 'Перейти к списку задач'}
                          {act.target.type === 'team' && 'Карточка специалиста'}
                        </span>
                        <ArrowRight className="w-3 h-3 transition-transform group-hover/link:translate-x-0.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="px-5 py-2.5 border-t border-[#27272a] bg-[#09090b]/60 flex items-center justify-between text-[11px] text-[#71717a]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          <span>Служба оперативного протоколирования 360PROFI</span>
        </div>
        <div className="font-mono text-[10.5px]">
          {filteredActivities.length} из {activities.length} событий
        </div>
      </div>
    </div>
  );
};
