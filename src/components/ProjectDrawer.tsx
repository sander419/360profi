import React, { useState } from 'react';
import {
  X,
  Check,
  ChevronRight,
  Calendar,
  Box,
  FileText,
  ArrowRight,
  AlertTriangle,
  Receipt,
  Plus,
  Trash2,
  BellRing,
  RotateCcw,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar } from './common/Avatar';
import { CircularProgress } from './common/CircularProgress';
import { BreakdownBars } from './common/BreakdownBars';
import { fmtRu, daysLeft, pctColor } from '../data/seedData';
import {
  getProjectBudgetStats,
  formatRuCurrency,
  parseBudget
} from '../utils/budgetAlerts';

export const ProjectDrawer: React.FC = () => {
  const {
    selectedProjectId,
    closeProject,
    projById,
    userById,
    eqById,
    state,
    toggleCheckItem,
    toggleDeadline,
    setTaskFilter,
    switchView,
    getReadiness,
    addProjectExpense,
    removeProjectExpense,
    triggerBudgetThresholdCheck,
    resetProjectBudgetAlerts
  } = useApp();

  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>({
    0: true,
    1: true
  });

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Оборудование');

  if (!selectedProjectId) return null;

  const project = projById(selectedProjectId);
  if (!project) return null;

  const manager = userById(project.manager);
  const readiness = getReadiness(project);
  const days = daysLeft(project.date);
  const projectDocs = state.docs.filter((d) => d.project === project.id);

  const toggleCategory = (idx: number) => {
    setOpenCategories((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleGoToTasks = () => {
    setTaskFilter({
      project: project.id,
      status: 'open',
      assignee: 'all'
    });
    closeProject();
    switchView('tasks');
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        onClick={closeProject}
      />

      {/* Slide-out Drawer */}
      <aside className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-[#18181b] border-l border-[#27272a] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Hero Header */}
        <div className="relative h-44 flex-none overflow-hidden">
          <img
            src={project.img}
            alt={project.title}
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={closeProject}
            className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-lg bg-[#09090b]/80 border border-[#27272a] flex items-center justify-center text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#09090b] transition-all cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title and tags in header */}
          <div className="absolute left-5 right-5 bottom-3.5 z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-[#6366f1]/20 text-[#6366f1] font-semibold border border-[#6366f1]/30">
                {project.id}
              </span>
              <span
                className={`text-[10.5px] font-medium px-2.5 py-0.5 rounded-full border ${
                  project.status === 'active'
                    ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25'
                    : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a]'
                }`}
              >
                {project.status === 'active' ? 'в работе' : 'завершён'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#fafafa] tracking-tight leading-snug">
              {project.title}
            </h2>
          </div>
        </div>

        {/* Drawer Body Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3">
              <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1">
                Клиент
              </div>
              <div className="font-medium text-[13px] text-[#fafafa] truncate">
                {project.client}
              </div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3">
              <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1">
                Площадка
              </div>
              <div className="font-medium text-[13px] text-[#fafafa] truncate">
                {project.venue}
              </div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3">
              <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1">
                Дата события
              </div>
              <div className="font-medium text-[13px] text-[#fafafa] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6366f1]" />
                {fmtRu(project.date)} ·{' '}
                <span className="font-normal text-xs text-[#a1a1aa]">
                  {days === 0 ? 'сегодня' : days > 0 ? `через ${days} дн` : `${Math.abs(days)} дн назад`}
                </span>
              </div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3">
              <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1">
                Бюджет
              </div>
              <div className="font-medium font-mono text-[13px] text-[#fafafa]">
                {project.budget}
              </div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3">
              <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1">
                Ответственный менеджер
              </div>
              <div className="font-medium text-[13px] text-[#fafafa] truncate">
                {manager?.name || '—'}
              </div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1">
                  Общая готовность
                </div>
                <div
                  className="font-bold font-mono text-base"
                  style={{ color: pctColor(readiness) }}
                >
                  {readiness}%
                </div>
              </div>
              <CircularProgress value={readiness} size={38} strokeWidth={4} />
            </div>
          </div>

          {/* Project Technical Description */}
          {project.description && (
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3.5">
              <div className="text-[10px] tracking-wider uppercase text-[#71717a] font-medium mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Техническое описание и сетап</span>
              </div>
              <p className="text-[13px] text-[#e4e4e7] leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          {/* Section: Budget & Spending Control (80% and 95% threshold alert system) */}
          {(() => {
            const stats = getProjectBudgetStats(project);
            const expensesList = project.expenses || [];
            const alerted = project.alertedBudgetThresholds || [];

            const handleAddExpenseSubmit = (e: React.FormEvent) => {
              e.preventDefault();
              const num = parseInt(expenseAmount.replace(/[^\d]/g, ''), 10);
              if (!num || num <= 0 || !expenseTitle.trim()) return;
              addProjectExpense(project.id, {
                title: expenseTitle.trim(),
                amount: num,
                category: expenseCategory,
                date: new Date().toISOString().slice(0, 10)
              });
              setExpenseTitle('');
              setExpenseAmount('');
              setShowAddExpense(false);
            };

            const handleQuickExpense = (title: string, amount: number, category: string) => {
              addProjectExpense(project.id, {
                title,
                amount,
                category,
                date: new Date().toISOString().slice(0, 10)
              });
            };

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium">
                      Контроль бюджета и пороги
                    </h4>
                    {stats.isOver95 ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#f43f5e] bg-[#f43f5e]/15 border border-[#f43f5e]/30 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Порог 95% превышен
                      </span>
                    ) : stats.isOver80 ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#f59e0b] bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Порог 80% достигнут
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#10b981] bg-[#10b981]/15 border border-[#10b981]/30 px-2 py-0.5 rounded-full">
                        В норме (&lt;80%)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerBudgetThresholdCheck(project.id)}
                    className="text-xs text-[#a1a1aa] hover:text-[#fafafa] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Проверить пороги и уведомить через ToastContainer при достижении 80% или 95%"
                  >
                    <BellRing className="w-3 h-3 text-amber-400" />
                    <span>Проверить</span>
                  </button>
                </div>

                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-4">
                  {/* Visual Bar with 80% and 95% milestone tick marks */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#a1a1aa] flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#6366f1]" />
                        <span>Освоение бюджета</span>
                      </span>
                      <span className="font-mono font-bold text-[#fafafa]">
                        {stats.percent}%{' '}
                        <span className="font-normal text-xs text-[#71717a]">
                          ({formatRuCurrency(stats.spent)} из {formatRuCurrency(stats.allocated)})
                        </span>
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="relative w-full h-3.5 bg-[#18181b] rounded-full overflow-hidden border border-[#27272a]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stats.isOver95
                            ? 'bg-gradient-to-r from-[#f59e0b] to-[#f43f5e]'
                            : stats.isOver80
                            ? 'bg-gradient-to-r from-[#10b981] to-[#f59e0b]'
                            : 'bg-[#10b981]'
                        }`}
                        style={{ width: `${Math.min(100, stats.percent)}%` }}
                      />

                      {/* 80% threshold line marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
                        style={{ left: '80%' }}
                        title="Порог 80%"
                      />

                      {/* 95% threshold line marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                        style={{ left: '95%' }}
                        title="Порог 95%"
                      />
                    </div>

                    {/* Axis Labels for 0%, 80%, 95%, 100% */}
                    <div className="relative text-[10px] text-[#71717a] font-mono mt-1 h-3.5">
                      <span className="absolute left-0">0%</span>
                      <span className="absolute left-[80%] -translate-x-1/2 text-amber-400 font-semibold">
                        80%
                      </span>
                      <span className="absolute left-[95%] -translate-x-1/2 text-rose-400 font-semibold">
                        95%
                      </span>
                      <span className="absolute right-0">100%</span>
                    </div>
                  </div>

                  {/* Summary metric cells */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#27272a]">
                    <div className="p-2.5 rounded-lg bg-[#18181b] border border-[#27272a]/70">
                      <div className="text-[10px] uppercase text-[#71717a] font-medium">Выделено</div>
                      <div className="font-mono text-xs font-semibold text-[#fafafa] mt-0.5 truncate">
                        {formatRuCurrency(stats.allocated)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#18181b] border border-[#27272a]/70">
                      <div className="text-[10px] uppercase text-[#71717a] font-medium">Израсходовано</div>
                      <div
                        className={`font-mono text-xs font-semibold mt-0.5 truncate ${
                          stats.isOver95
                            ? 'text-[#f43f5e]'
                            : stats.isOver80
                            ? 'text-[#f59e0b]'
                            : 'text-[#fafafa]'
                        }`}
                      >
                        {formatRuCurrency(stats.spent)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#18181b] border border-[#27272a]/70">
                      <div className="text-[10px] uppercase text-[#71717a] font-medium">Остаток</div>
                      <div
                        className={`font-mono text-xs font-semibold mt-0.5 truncate ${
                          stats.remaining < 0 ? 'text-[#f43f5e]' : 'text-[#10b981]'
                        }`}
                      >
                        {formatRuCurrency(stats.remaining)}
                      </div>
                    </div>
                  </div>

                  {/* Threshold Alert Indicators & Reset Button */}
                  <div className="p-3 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[#a1a1aa]">Сработавшие алерты:</span>
                      {alerted.length === 0 ? (
                        <span className="text-[#71717a] font-mono text-[11px]">нет срабатываний</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {alerted.map((t) => (
                            <span
                              key={t}
                              className={`font-mono text-[10.5px] px-2 py-0.5 rounded-md font-semibold ${
                                t === 95
                                  ? 'bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/40'
                                  : 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40'
                              }`}
                            >
                              {t}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {alerted.length > 0 && (
                      <button
                        type="button"
                        onClick={() => resetProjectBudgetAlerts(project.id)}
                        className="flex items-center gap-1 text-[11px] text-[#a1a1aa] hover:text-[#fafafa] bg-[#27272a]/50 hover:bg-[#27272a] px-2 py-1 rounded-md transition-colors cursor-pointer"
                        title="Сбросить статус срабатывания, чтобы система могла при необходимости отправить повторный алерт"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Сбросить флаги</span>
                      </button>
                    )}
                  </div>

                  {/* Expenses & Quick Simulation Buttons */}
                  <div className="space-y-2.5 pt-2 border-t border-[#27272a]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#fafafa] flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-[#6366f1]" />
                        <span>Статьи расходов ({expensesList.length})</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setShowAddExpense((v) => !v)}
                        className="flex items-center gap-1 text-xs text-[#6366f1] hover:text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showAddExpense ? 'Отмена' : 'Внести расход'}</span>
                      </button>
                    </div>

                    {/* Quick test buttons to push thresholds and demonstrate alert immediately */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-[#71717a]">Быстрый расход:</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickExpense('Дополнительная аренда световых приборов', 50000, 'Оборудование')
                        }
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                      >
                        +50 000 ₽
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickExpense('Срочный заказ резервных генераторов 100 кВт', 150000, 'Логистика')
                        }
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                      >
                        +150 000 ₽
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickExpense('Спецэффекты: тяжелый дым и криопушки', 350000, 'Спецэффекты')
                        }
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                      >
                        +350 000 ₽
                      </button>
                    </div>

                    {/* Add Expense Form */}
                    {showAddExpense && (
                      <form
                        onSubmit={handleAddExpenseSubmit}
                        className="p-3 bg-[#18181b] border border-[#3f3f46] rounded-xl space-y-2.5 animate-in fade-in duration-150"
                      >
                        <div className="text-xs font-semibold text-[#fafafa]">
                          Добавление статьи расхода в проект
                        </div>
                        <input
                          type="text"
                          required
                          value={expenseTitle}
                          onChange={(e) => setExpenseTitle(e.target.value)}
                          placeholder="Наименование расхода (например: Аренда звуковых порталов)"
                          className="w-full px-3 py-1.5 rounded-lg bg-[#09090b] border border-[#27272a] text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1]"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            required
                            min="1000"
                            step="1000"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            placeholder="Сумма, ₽ (например: 120000)"
                            className="px-3 py-1.5 rounded-lg bg-[#09090b] border border-[#27272a] text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1]"
                          />

                          <select
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-[#27272a] text-xs text-[#fafafa] focus:outline-none focus:border-[#6366f1]"
                          >
                            <option value="Оборудование">Оборудование</option>
                            <option value="Логистика">Логистика</option>
                            <option value="Конструкции">Конструкции</option>
                            <option value="Свет">Свет</option>
                            <option value="Звук">Звук</option>
                            <option value="Видео/Стрим">Видео/Стрим</option>
                            <option value="Спецэффекты">Спецэффекты</option>
                            <option value="Персонал">Персонал</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAddExpense(false)}
                            className="px-2.5 py-1 rounded-md text-xs text-[#a1a1aa] hover:text-[#fafafa]"
                          >
                            Отмена
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-md bg-[#6366f1] hover:bg-indigo-500 text-xs font-medium text-white transition-colors cursor-pointer"
                          >
                            Сохранить расход
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Expenses List */}
                    {expensesList.length === 0 ? (
                      <div className="text-center py-3 text-xs text-[#71717a]">
                        Расходы пока не зафиксированы
                      </div>
                    ) : (
                      <div className="divide-y divide-[#27272a] rounded-lg border border-[#27272a] bg-[#18181b]/50 max-h-48 overflow-y-auto">
                        {expensesList.map((exp) => (
                          <div
                            key={exp.id}
                            className="px-3 py-2 flex items-center justify-between text-xs hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium text-[#fafafa] truncate">
                                {exp.title}
                              </div>
                              <div className="text-[10px] text-[#71717a] flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded bg-[#27272a] text-[#a1a1aa]">
                                  {exp.category}
                                </span>
                                <span>{exp.date}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 flex-none">
                              <span className="font-mono font-semibold text-[#fafafa]">
                                {formatRuCurrency(exp.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeProjectExpense(project.id, exp.id)}
                                className="p-1 rounded text-[#71717a] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 transition-colors cursor-pointer"
                                title="Удалить расход"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section: Breakdown Bars */}
          <div>
            <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium mb-3">
              Готовность по 5 осям
            </h4>
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4">
              <BreakdownBars breakdown={project.breakdown} isLarge />
            </div>
          </div>

          {/* Section: Deadlines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium">
                Дедлайны
              </h4>
              <button
                onClick={handleGoToTasks}
                className="flex items-center gap-1 text-xs text-[#6366f1] font-medium hover:underline cursor-pointer"
              >
                <span>Задачи проекта</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-xl divide-y divide-[#27272a] overflow-hidden">
              {project.deadlines.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#71717a]">
                  Дедлайны не заданы
                </div>
              ) : (
                project.deadlines.map((d, di) => {
                  const isOver = !d.done && daysLeft(d.due) < 0;
                  return (
                    <div
                      key={di}
                      onClick={() => toggleDeadline(project.id, di)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-none ${
                          d.done
                            ? 'bg-[#10b981] border-[#10b981] text-[#09090b]'
                            : 'border-[#3f3f46] hover:border-[#6366f1]'
                        }`}
                      >
                        {d.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <span
                        className={`flex-1 text-[13px] font-medium leading-tight ${
                          d.done ? 'line-through text-[#71717a]' : 'text-[#fafafa]'
                        }`}
                      >
                        {d.t}
                      </span>

                      <span
                        className={`font-mono text-xs px-2.5 py-0.5 rounded-md flex-none border ${
                          isOver
                            ? 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25 font-semibold'
                            : 'bg-[#18181b] text-[#a1a1aa] border-[#27272a]'
                        }`}
                      >
                        {fmtRu(d.due)} {isOver && '· просрочен'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section: Checklists */}
          <div>
            <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium mb-3">
              Чек-листы подготовки
            </h4>

            {project.checks.length === 0 ? (
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 text-center text-xs text-[#71717a]">
                Чек-листы не заведены
              </div>
            ) : (
              <div className="space-y-2.5">
                {project.checks.map((grp, gi) => {
                  const doneCount = grp.items.filter((i) => i.done).length;
                  const totalCount = grp.items.length;
                  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
                  const isOpen = openCategories[gi] ?? false;

                  return (
                    <div
                      key={gi}
                      className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleCategory(gi)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-medium text-[13px] text-[#fafafa] hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <span className="flex-1">{grp.cat}</span>

                        {/* Progress Bar */}
                        <div className="w-20 h-1.5 rounded-full bg-[#27272a] overflow-hidden flex-none">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pctColor(pct)
                            }}
                          />
                        </div>

                        <span className="font-mono text-xs text-[#a1a1aa] w-9 text-right flex-none">
                          {doneCount}/{totalCount}
                        </span>

                        <ChevronRight
                          className={`w-4 h-4 text-[#71717a] transition-transform duration-200 flex-none ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 border-t border-[#27272a]/60 space-y-2">
                          {grp.items.map((it, ii) => (
                            <div
                              key={ii}
                              onClick={() => toggleCheckItem(project.id, gi, ii)}
                              className="flex items-start gap-2.5 py-1 text-[13px] cursor-pointer hover:opacity-85 select-none"
                            >
                              <div
                                className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors flex-none ${
                                  it.done
                                    ? 'bg-[#10b981] border-[#10b981] text-[#09090b]'
                                    : 'border-[#3f3f46] hover:border-[#6366f1]'
                                }`}
                              >
                                {it.done && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span
                                className={
                                  it.done
                                    ? 'line-through text-[#71717a]'
                                    : 'text-[#fafafa]'
                                }
                              >
                                {it.t}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Project Team */}
          <div>
            <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium mb-3">
              Команда проекта ({project.teamIds.length})
            </h4>

            <div className="space-y-2">
              {project.teamIds.map((tid) => {
                const u = userById(tid);
                if (!u) return null;
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 bg-[#09090b] border border-[#27272a] rounded-xl p-3"
                  >
                    <Avatar name={u.name} size="md" />
                    <div className="flex-1 truncate">
                      <div className="font-medium text-[13px] text-[#fafafa] truncate">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-[#71717a]">
                        {u.role} · загрузка {u.load}%
                      </div>
                    </div>
                    <span
                      className={`text-[10.5px] font-medium px-2.5 py-0.5 rounded-full border ${
                        u.load > 85
                          ? 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/25'
                          : u.status === 'Свободен'
                          ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25'
                          : 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/25'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Project Equipment */}
          <div>
            <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium mb-3">
              Оборудование проекта ({project.eqIds.length})
            </h4>

            {project.eqIds.length === 0 ? (
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 text-center text-xs text-[#71717a]">
                Оборудование не закреплено
              </div>
            ) : (
              <div className="space-y-2">
                {project.eqIds.map((eid) => {
                  const eq = eqById(eid);
                  if (!eq) return null;
                  return (
                    <div
                      key={eq.id}
                      className="flex items-center gap-2.5 bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-[13px] font-medium"
                    >
                      <Box className="w-4 h-4 text-[#71717a] flex-none" />
                      <span className="flex-1 truncate text-[#fafafa] font-medium">
                        {eq.name}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa] flex-none">
                        {eq.cat}
                      </span>
                      {eq.issues > 0 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25 flex-none">
                          {eq.issues} неиспр.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Project Documents */}
          {projectDocs.length > 0 && (
            <div>
              <h4 className="text-[11px] tracking-[1.4px] uppercase text-[#71717a] font-medium mb-3">
                Документы проекта
              </h4>
              <div className="space-y-2">
                {projectDocs.map((doc) => {
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

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2.5 bg-[#09090b] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-[13px]"
                    >
                      <FileText className="w-4 h-4 text-[#71717a] flex-none" />
                      <span className="flex-1 truncate text-[#fafafa] font-medium">
                        {doc.name}
                      </span>
                      {doc.due && (
                        <span className="font-mono text-xs text-[#a1a1aa] flex-none">
                          {fmtRu(doc.due)}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-none border ${
                          statusBadges[doc.status]
                        }`}
                      >
                        {statusTexts[doc.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
