import React, { useState } from 'react';
import {
  X,
  Zap,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  Bell,
  AlertTriangle,
  ArrowRight,
  Clock,
  Settings2,
  History,
  SlidersHorizontal,
  ListChecks,
  Check,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  AutomationTrigger,
  AutomationAction,
  TaskAutomationRule
} from '../../types';
import { fmtRu } from '../../data/seedData';

const TRIGGER_OPTIONS: {
  id: AutomationTrigger;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    id: 'all_subtasks_checked',
    label: 'Все подзадачи чеклиста отмечены как выполненные',
    desc: 'Срабатывает, когда пользователь закрывает последнюю оставшуюся подзадачу задачи',
    icon: ListChecks,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
  },
  {
    id: 'deadline_overdue',
    label: 'Дедлайн задачи просрочен (текущая дата > срок сдачи)',
    desc: 'Срабатывает при наступлении просрочки срока выполнения для незакрытой задачи',
    icon: Clock,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/25'
  },
  {
    id: 'first_subtask_checked',
    label: 'Выполнена первая подзадача (старт работ)',
    desc: 'Срабатывает, когда начата работа над задачей из очереди',
    icon: Check,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25'
  },
  {
    id: 'high_prio_overdue',
    label: 'Критическая High-Priority задача просрочена',
    desc: 'Срабатывает для важных задач при нарушении планового срока сдачи',
    icon: ShieldAlert,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/25'
  }
];

const ACTION_OPTIONS: {
  id: AutomationAction;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    id: 'move_to_done',
    label: 'Автоматически переместить в статус «Выполнено»',
    desc: 'Переводит задачу в колонку Done и фиксирует успешное закрытие в ленте активности',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
  },
  {
    id: 'notify_pm',
    label: 'Уведомить руководителя проекта (РП) и создать алерт',
    desc: 'Определяет ответственного РП по проекту, генерирует критический алерт и звуковое оповещение',
    icon: Bell,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/25'
  },
  {
    id: 'move_to_inwork',
    label: 'Автоматически перевести в «В работе» (In Progress)',
    desc: 'Забирает задачу из очереди Todo в работу при фиксации первого прогресса',
    icon: ArrowRight,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25'
  },
  {
    id: 'create_alert',
    label: 'Сформировать экстренный алерт в ленту штаба',
    desc: 'Выводит тревожное уведомление высшего приоритета на главный пульт диспетчера',
    icon: AlertTriangle,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/25'
  }
];

export const AutomationRulesModal: React.FC = () => {
  const {
    state,
    isRulesModalOpen,
    setIsRulesModalOpen,
    toggleAutomationRule,
    addAutomationRule,
    deleteAutomationRule,
    runRulesEngine,
    clearAutomationLogs,
    projById
  } = useApp();

  const [activeTab, setActiveTab] = useState<'rules' | 'create' | 'logs'>('rules');

  // New Rule Form State
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('all_subtasks_checked');
  const [action, setAction] = useState<AutomationAction>('move_to_done');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [description, setDescription] = useState('');
  const [isExecutingAll, setIsExecutingAll] = useState(false);

  if (!isRulesModalOpen) return null;

  const rules = state.automationRules || [];
  const logs = state.automationLogs || [];
  const activeRulesCount = rules.filter((r) => r.enabled).length;

  const handleRunAllNow = () => {
    setIsExecutingAll(true);
    try {
      runRulesEngine();
    } finally {
      setTimeout(() => setIsExecutingAll(false), 500);
    }
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addAutomationRule({
      name: name.trim(),
      description: description.trim() || undefined,
      trigger,
      action,
      enabled: true,
      projectFilter,
      priorityFilter
    });

    // Reset and switch to rules tab
    setName('');
    setDescription('');
    setTrigger('all_subtasks_checked');
    setAction('move_to_done');
    setProjectFilter('all');
    setPriorityFilter('all');
    setActiveTab('rules');
  };

  const selectedTriggerMeta = TRIGGER_OPTIONS.find((t) => t.id === trigger);
  const selectedActionMeta = ACTION_OPTIONS.find((a) => a.id === action);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[820px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-[#27272a] flex items-center justify-between gap-3 bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#fafafa] tracking-tight">
                  Движок автоматизации задач (Rules Engine)
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  {activeRulesCount} активных
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Автоматические триггеры, автозавершение задач по подзадачам и оповещения РП о просрочках
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRulesModalOpen(false)}
              className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Закрыть окно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation & Toolbar */}
        <div className="px-6 py-2.5 border-b border-[#27272a] bg-[#18181b] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Правила ({rules.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать правило</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-[#6366f1] text-white shadow-xs'
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Журнал срабатываний</span>
              {logs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[#d4d4d8] text-[10px] font-mono">
                  {logs.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAllNow}
              disabled={isExecutingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-medium transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Выполнить проверку условий всех активных правил прямо сейчас"
            >
              <Play className={`w-3.5 h-3.5 ${isExecutingAll ? 'animate-spin' : ''}`} />
              <span>Проверить и запустить</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* TAB 1: RULES LIST */}
          {activeTab === 'rules' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-[#a1a1aa] px-1">
                <span>
                  Настроенные правила автоматизации ({rules.length}). Активные правила выполняются в реальном времени.
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Автопроверка при смене статусов и кликах
                </span>
              </div>

              {rules.length === 0 ? (
                <div className="p-8 text-center bg-[#141416] border border-[#27272a] rounded-xl text-[#71717a]">
                  Нет настроенных правил. Нажмите «Создать правило», чтобы добавить автоматизацию.
                </div>
              ) : (
                rules.map((rule) => {
                  const trMeta = TRIGGER_OPTIONS.find((t) => t.id === rule.trigger);
                  const acMeta = ACTION_OPTIONS.find((a) => a.id === rule.action);
                  const TrIcon = trMeta?.icon || Zap;
                  const AcIcon = acMeta?.icon || Zap;
                  const project = rule.projectFilter && rule.projectFilter !== 'all' ? projById(rule.projectFilter) : null;

                  return (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-xl border transition-all ${
                        rule.enabled
                          ? 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]'
                          : 'bg-[#121214] border-[#202023] opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Title & Status Toggle */}
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-sm text-[#fafafa]">
                              {rule.name}
                            </span>
                            {rule.isDefault && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#27272a] text-[#a1a1aa] font-medium">
                                Предустановленное
                              </span>
                            )}
                          </div>

                          {rule.description && (
                            <p className="text-xs text-[#a1a1aa] leading-relaxed">
                              {rule.description}
                            </p>
                          )}

                          {/* Visual Trigger -> Action Diagram */}
                          <div className="flex items-center gap-2 flex-wrap pt-2">
                            {/* Trigger Pill */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#09090b] border border-[#27272a] text-[#fafafa] font-medium">
                              <TrIcon className="w-3.5 h-3.5 text-amber-400 flex-none" />
                              <span className="text-[#a1a1aa]">Триггер:</span>
                              <span className="text-zinc-200 truncate max-w-[240px]">
                                {trMeta?.label || rule.trigger}
                              </span>
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-[#71717a] flex-none" />

                            {/* Action Pill */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#09090b] border border-[#27272a] text-[#fafafa] font-medium">
                              <AcIcon className="w-3.5 h-3.5 text-emerald-400 flex-none" />
                              <span className="text-[#a1a1aa]">Действие:</span>
                              <span className="text-zinc-200 truncate max-w-[240px]">
                                {acMeta?.label || rule.action}
                              </span>
                            </div>
                          </div>

                          {/* Meta Badges */}
                          <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-[#71717a]">
                            <span className="px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa]">
                              Проект: {project ? project.title : 'Все проекты'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa]">
                              Приоритет: {rule.priorityFilter === 'all' || !rule.priorityFilter ? 'Любой' : rule.priorityFilter}
                            </span>
                            <span className="text-amber-400/90 font-mono">
                              ⚡ Сработало: {rule.triggerCount || 0} раз
                            </span>
                            {rule.lastFiredAt && (
                              <span className="text-zinc-400">
                                · Последний раз: {new Date(rule.lastFiredAt).toLocaleTimeString('ru-RU')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Controls on Right */}
                        <div className="flex items-center gap-2 flex-none">
                          {/* Run this rule specifically */}
                          <button
                            type="button"
                            onClick={() => runRulesEngine(rule.id)}
                            className="p-1.5 rounded-lg border border-[#27272a] bg-[#141416] text-[#a1a1aa] hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer"
                            title="Протестировать это правило"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>

                          {/* Switch toggle */}
                          <button
                            type="button"
                            onClick={() => toggleAutomationRule(rule.id)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                              rule.enabled ? 'bg-emerald-500' : 'bg-[#27272a]'
                            }`}
                            title={rule.enabled ? 'Отключить правило' : 'Включить правило'}
                          >
                            <span
                              className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                rule.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => deleteAutomationRule(rule.id)}
                            className="p-1.5 rounded-lg border border-[#27272a] bg-[#141416] text-[#71717a] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer ml-1"
                            title="Удалить правило"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: CREATE RULE CONSTRUCTOR */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div className="bg-[#141416] border border-[#27272a] rounded-xl p-4 space-y-4">
                <h4 className="font-semibold text-sm text-[#fafafa] flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-amber-400" />
                  Параметры нового правила автоматизации
                </h4>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                    Название правила *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Автозавершение монтажных задач при закрытии подзадач"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                    Краткое описание логики (опционально)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Опишите, при каких условиях и для кого срабатывает триггер"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>

                {/* Trigger Selector */}
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                    1. Выберите триггер (Когда происходит событие) *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {TRIGGER_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = trigger === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setTrigger(opt.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#6366f1]/10 border-[#6366f1] ring-1 ring-[#6366f1]'
                              : 'bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-medium text-xs text-[#fafafa] mb-1">
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#6366f1]' : 'text-[#a1a1aa]'}`} />
                            <span className={isSelected ? 'text-[#818cf8]' : ''}>{opt.label}</span>
                          </div>
                          <p className="text-[11px] text-[#71717a] pl-5.5 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Selector */}
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                    2. Выберите действие (Тогда выполнить) *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {ACTION_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = action === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setAction(opt.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#10b981]/10 border-[#10b981] ring-1 ring-[#10b981]'
                              : 'bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-medium text-xs text-[#fafafa] mb-1">
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#10b981]' : 'text-[#a1a1aa]'}`} />
                            <span className={isSelected ? 'text-[#34d399]' : ''}>{opt.label}</span>
                          </div>
                          <p className="text-[11px] text-[#71717a] pl-5.5 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filter Conditions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                      Фильтр по проекту
                    </label>
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1]"
                    >
                      <option value="all">Все проекты (Глобально)</option>
                      {state.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id} · {p.title}
                        </option>
                      ))}
                      <option value="base">Склад / база</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                      Фильтр по приоритету задачи
                    </label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1]"
                    >
                      <option value="all">Любой приоритет</option>
                      <option value="high">Высокий (High priority)</option>
                      <option value="med">Средний (Medium)</option>
                      <option value="low">Низкий (Low)</option>
                    </select>
                  </div>
                </div>

                {/* Preview Formula */}
                <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center gap-2 text-xs text-[#a1a1aa]">
                  <Zap className="w-4 h-4 text-amber-400 flex-none" />
                  <span className="text-[#fafafa] font-medium">Формула:</span>
                  <span>
                    ЕСЛИ ({selectedTriggerMeta?.label || trigger}) И ПРОЕКТ ({projectFilter === 'all' ? 'Любой' : projectFilter}) ➔ ВЫПОЛНИТЬ ({selectedActionMeta?.label || action})
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('rules')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  Сохранить и активировать правило
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[#a1a1aa]">
                  История автоматических срабатываний триггеров ({logs.length} записей)
                </span>
                {logs.length > 0 && (
                  <button
                    onClick={clearAutomationLogs}
                    className="text-xs text-[#71717a] hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Очистить журнал</span>
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="p-10 text-center bg-[#141416] border border-[#27272a] rounded-xl text-[#71717a]">
                  Журнал пуст. При срабатывании правил здесь будут фиксироваться записи с деталями действий.
                </div>
              ) : (
                <div className="bg-[#141416] border border-[#27272a] rounded-xl divide-y divide-[#27272a] overflow-hidden">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3.5 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                      <div className="w-7 h-7 mt-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-none">
                        <Zap className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-[#fafafa]">
                            {log.ruleName}
                          </span>
                          <span className="text-[11px] font-mono text-[#71717a]">
                            {new Date(log.timestamp).toLocaleString('ru-RU')}
                          </span>
                        </div>

                        <div className="text-xs text-[#a1a1aa] leading-snug">
                          {log.actionTaken}
                        </div>

                        <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                          <span className="font-mono text-zinc-400">
                            Задача: «{log.taskTitle}»
                          </span>
                          {log.targetManager && (
                            <span className="px-1.5 py-0.2 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              Оповещен РП: {log.targetManager}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#27272a] bg-[#141416] flex items-center justify-between text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Автоматический движок активен и ожидает событий</span>
          </div>
          <button
            onClick={() => setIsRulesModalOpen(false)}
            className="px-4 py-1.5 rounded-xl border border-[#27272a] bg-[#18181b] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
