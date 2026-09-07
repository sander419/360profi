import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  ShieldCheck,
  TrendingUp,
  Info,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project } from '../../types';
import { daysLeft } from '../../data/seedData';

interface ProjectsHealthCardProps {
  onOpenProject?: (id: string) => void;
}

export const ProjectsHealthCard: React.FC<ProjectsHealthCardProps> = ({ onOpenProject }) => {
  const { state, getReadiness, projFilter } = useApp();

  // Target active projects (or filtered projects if any active exist)
  const targetProjects = useMemo(() => {
    const list = state.projects.filter((p) => {
      if (projFilter === 'done') return p.status === 'done';
      return p.status === 'active';
    });
    return list.length > 0 ? list : state.projects;
  }, [state.projects, projFilter]);

  // Compute metrics
  const healthMetrics = useMemo(() => {
    if (targetProjects.length === 0) {
      return {
        overallScore: 100,
        taskScore: 100,
        deadlineScore: 100,
        budgetScore: 100,
        totalBudgetNum: 0,
        spentBudgetNum: 0,
        totalDeadlines: 0,
        overdueDeadlines: 0,
        doneDeadlines: 0,
        totalTasks: 0,
        doneTasks: 0,
        totalChecks: 0,
        doneChecks: 0,
        criticalProjects: [] as Project[]
      };
    }

    // 1. Task & Readiness Completion
    let totalReadinessSum = 0;
    let totalChecks = 0;
    let doneChecks = 0;
    let totalDeadlines = 0;
    let doneDeadlines = 0;
    let overdueDeadlines = 0;
    let totalBudgetNum = 0;
    let spentBudgetNum = 0;
    const criticalProjects: Project[] = [];

    targetProjects.forEach((p) => {
      const r = getReadiness(p);
      totalReadinessSum += r;

      // Parse budget string e.g. "2 400 000 ₽"
      const numBudget = parseInt(p.budget.replace(/[^\d]/g, ''), 10) || 0;
      totalBudgetNum += numBudget;
      const projSpent = typeof p.spentBudget === 'number'
        ? p.spentBudget
        : (p.expenses && p.expenses.length > 0)
        ? p.expenses.reduce((s, e) => s + e.amount, 0)
        : Math.round(numBudget * (r / 100));
      spentBudgetNum += projSpent;

      // Checks
      (p.checks || []).forEach((c) => {
        (c.items || []).forEach((item) => {
          totalChecks++;
          if (item.done) doneChecks++;
        });
      });

      // Deadlines
      let projOverdue = 0;
      (p.deadlines || []).forEach((dl) => {
        totalDeadlines++;
        if (dl.done) {
          doneDeadlines++;
        } else if (daysLeft(dl.due) < 0) {
          overdueDeadlines++;
          projOverdue++;
        }
      });

      if (projOverdue > 0 || r < 40) {
        criticalProjects.push(p);
      }
    });

    // Associated tasks from state.tasks
    const targetProjectIds = new Set(targetProjects.map((p) => p.id));
    const relevantTasks = state.tasks.filter((t) => targetProjectIds.has(t.project));
    const totalTasks = relevantTasks.length;
    const doneTasks = relevantTasks.filter((t) => t.status === 'done').length;

    // Averages and scores
    const avgReadiness = Math.round(totalReadinessSum / targetProjects.length);
    const checksPct = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : avgReadiness;
    const tasksPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : avgReadiness;

    // Task Completion Score (weighted: 50% readiness, 30% tasks, 20% checklist)
    const taskScore = Math.min(100, Math.round(avgReadiness * 0.5 + tasksPct * 0.3 + checksPct * 0.2));

    // Deadline Adherence Score
    const deadlineScore = totalDeadlines > 0
      ? Math.max(0, Math.min(100, Math.round(((totalDeadlines - overdueDeadlines) / totalDeadlines) * 100)))
      : 100;

    // Budget Utilization & Efficiency Score
    const budgetUtilizationPct = totalBudgetNum > 0
      ? Math.round((spentBudgetNum / totalBudgetNum) * 100)
      : 0;

    // Budget Health: 100 minus penalty if deadlines are missed with high spend
    const budgetScore = Math.max(
      40,
      Math.min(100, Math.round(96 - (overdueDeadlines > 0 ? overdueDeadlines * 4 : 0)))
    );

    // High-Level Health Score: 35% Task Completion + 40% Deadline Adherence + 25% Budget Utilization
    const overallScore = Math.round(taskScore * 0.35 + deadlineScore * 0.4 + budgetScore * 0.25);

    return {
      overallScore,
      taskScore,
      deadlineScore,
      budgetScore,
      budgetUtilizationPct,
      totalBudgetNum,
      spentBudgetNum,
      totalDeadlines,
      overdueDeadlines,
      doneDeadlines,
      totalTasks,
      doneTasks,
      totalChecks,
      doneChecks,
      criticalProjects
    };
  }, [targetProjects, getReadiness, state.tasks]);

  const {
    overallScore,
    taskScore,
    deadlineScore,
    budgetScore,
    budgetUtilizationPct,
    totalBudgetNum,
    spentBudgetNum,
    totalDeadlines,
    overdueDeadlines,
    doneDeadlines,
    totalTasks,
    doneTasks,
    criticalProjects
  } = healthMetrics;

  // Format Millions of Rubles
  const formatMillions = (num: number) => {
    return (num / 1000000).toFixed(1) + ' млн ₽';
  };

  // Color config based on health score
  const healthTheme = useMemo(() => {
    if (overallScore >= 80) {
      return {
        color: '#10b981',
        bg: 'bg-[#10b981]/15',
        border: 'border-[#10b981]/30',
        textColor: 'text-[#10b981]',
        label: 'Штатное / Стабильное',
        desc: 'Проекты реализуются в графике, бюджет и задачи под контролем'
      };
    }
    if (overallScore >= 60) {
      return {
        color: '#f59e0b',
        bg: 'bg-[#f59e0b]/15',
        border: 'border-[#f59e0b]/30',
        textColor: 'text-[#f59e0b]',
        label: 'Умеренные риски',
        desc: 'Есть просроченные контрольные точки или отставания по подготовке'
      };
    }
    return {
      color: '#f43f5e',
      bg: 'bg-[#f43f5e]/15',
      border: 'border-[#f43f5e]/30',
      textColor: 'text-[#f43f5e]',
      label: 'Критическое внимание',
      desc: 'Выявлены срывы сроков подготовки или дефицит готовности'
    };
  }, [overallScore]);

  // Data for Recharts Semi-circle Gauge
  const gaugeData = useMemo(() => {
    return [
      { name: 'Здоровье', value: overallScore, fill: healthTheme.color },
      { name: 'Остаток', value: Math.max(0, 100 - overallScore), fill: '#27272a' }
    ];
  }, [overallScore, healthTheme.color]);

  // Data for Recharts Bar Chart Breakdown
  const pillarsBarData = useMemo(() => {
    return [
      {
        category: 'Задачи',
        title: 'Готовность задач',
        value: taskScore,
        fill: '#6366f1',
        info: `${doneTasks}/${totalTasks} задач`
      },
      {
        category: 'Дедлайны',
        title: 'Соблюдение сроков',
        value: deadlineScore,
        fill: '#10b981',
        info: `${overdueDeadlines} просроч.`
      },
      {
        category: 'Бюджет',
        title: 'Освоение бюджета',
        value: budgetScore,
        fill: '#f59e0b',
        info: `${budgetUtilizationPct}% освоено`
      }
    ];
  }, [taskScore, deadlineScore, budgetScore, doneTasks, totalTasks, overdueDeadlines, budgetUtilizationPct]);

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Background soft ambient glow */}
      <div
        className="absolute -top-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: healthTheme.color }}
      />

      {/* Header Row */}
      <div className="flex items-start justify-between flex-wrap gap-3 pb-4 border-b border-[#27272a]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#fafafa] tracking-tight">
                Индекс здоровья проектов
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#27272a] text-[#a1a1aa]">
                {targetProjects.length} {targetProjects.length === 1 ? 'проект' : 'проектов'}
              </span>
            </div>
            <p className="text-xs text-[#71717a] mt-0.5">
              Сводная аналитика Recharts: готовность задач (35%), соблюдение сроков (40%) и освоение бюджетов (25%)
            </p>
          </div>
        </div>

        {/* Health Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${healthTheme.bg} ${healthTheme.border} ${healthTheme.textColor}`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{healthTheme.label}</span>
          </span>
        </div>
      </div>

      {/* Main Content Grid: Left Gauge + Center Pillars Bar Chart + Right Diagnostic KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4 items-center">
        {/* Left: Recharts Semi-circle Health Gauge (4 cols) */}
        <div className="lg:col-span-4 bg-[#09090b]/80 border border-[#27272a] rounded-xl p-4 flex flex-col items-center justify-center relative">
          <div className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider mb-1">
            Общий показатель здоровья
          </div>

          <div className="w-full h-[120px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                <Pie
                  data={gaugeData}
                  dataKey="value"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={50}
                  outerRadius={68}
                  stroke="none"
                  cx="50%"
                  cy="75%"
                  isAnimationActive={true}
                >
                  <Cell fill={healthTheme.color} />
                  <Cell fill="#27272a" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Score Center Text */}
            <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-3xl font-black font-mono text-[#fafafa] tracking-tight">
                {overallScore}
                <span className="text-sm font-normal text-[#71717a]">/100</span>
              </div>
              <div className="text-[10px] text-[#71717a] font-medium mt-0.5">
                {overallScore >= 80 ? 'высокий индекс' : overallScore >= 60 ? 'средний индекс' : 'требует мер'}
              </div>
            </div>
          </div>

          {/* Scale footer */}
          <div className="w-full flex items-center justify-between text-[10px] text-[#71717a] font-mono px-4 -mt-2">
            <span>0%</span>
            <span className="text-[#a1a1aa] font-sans font-medium">{healthTheme.desc}</span>
            <span>100%</span>
          </div>
        </div>

        {/* Center: Recharts 3 Pillars Bar Chart (4 cols) */}
        <div className="lg:col-span-4 bg-[#09090b]/80 border border-[#27272a] rounded-xl p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-[#a1a1aa] font-medium mb-1">
            <span>Структура показателей</span>
            <span className="text-[10px] text-[#71717a]">Вес осей</span>
          </div>

          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={pillarsBarData}
                margin={{ top: 8, right: 28, left: 10, bottom: 8 }}
                barSize={14}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={62}
                  stroke="#71717a"
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="bg-[#18181b] border border-[#3f3f46] rounded-lg p-2 text-xs shadow-xl z-50">
                        <div className="font-semibold text-[#fafafa]">{p.title}</div>
                        <div className="font-mono text-[#6366f1] text-sm mt-0.5">{p.value}%</div>
                        <div className="text-[10px] text-[#71717a] mt-1">{p.info}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {pillarsBarData.map((entry, index) => (
                    <Cell key={`pillar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#27272a] text-center">
            <div>
              <div className="text-[9px] text-[#71717a]">Задачи</div>
              <div className="font-mono text-xs font-bold text-[#6366f1]">{taskScore}%</div>
            </div>
            <div>
              <div className="text-[9px] text-[#71717a]">Дедлайны</div>
              <div className="font-mono text-xs font-bold text-[#10b981]">{deadlineScore}%</div>
            </div>
            <div>
              <div className="text-[9px] text-[#71717a]">Бюджет</div>
              <div className="font-mono text-xs font-bold text-[#f59e0b]">{budgetScore}%</div>
            </div>
          </div>
        </div>

        {/* Right: Detailed Metric Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          {/* Pillar 1: Tasks */}
          <div className="p-2.5 rounded-xl bg-[#09090b]/80 border border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 flex items-center justify-center text-[#818cf8] flex-none">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#fafafa] truncate">
                  Задачи и готовность
                </div>
                <div className="text-[11px] text-[#71717a] truncate">
                  {doneTasks} из {totalTasks} задач закрыто
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-[#818cf8]">
              {taskScore}%
            </span>
          </div>

          {/* Pillar 2: Deadlines */}
          <div className="p-2.5 rounded-xl bg-[#09090b]/80 border border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-none border ${
                  overdueDeadlines > 0
                    ? 'bg-[#f43f5e]/15 border-[#f43f5e]/30 text-[#f43f5e]'
                    : 'bg-[#10b981]/15 border-[#10b981]/30 text-[#10b981]'
                }`}
              >
                {overdueDeadlines > 0 ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#fafafa] truncate">
                  Соблюдение дедлайнов
                </div>
                <div className="text-[11px] text-[#71717a] truncate">
                  {overdueDeadlines > 0 ? (
                    <span className="text-[#f43f5e] font-medium">{overdueDeadlines} просрочено</span>
                  ) : (
                    <span>все {totalDeadlines} в графике</span>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`font-mono text-xs font-bold ${
                overdueDeadlines > 0 ? 'text-[#f43f5e]' : 'text-[#10b981]'
              }`}
            >
              {deadlineScore}%
            </span>
          </div>

          {/* Pillar 3: Budget */}
          <div className="p-2.5 rounded-xl bg-[#09090b]/80 border border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] flex-none">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#fafafa] truncate">
                  Освоение бюджета
                </div>
                <div className="text-[11px] text-[#71717a] truncate">
                  {formatMillions(spentBudgetNum)} из {formatMillions(totalBudgetNum)}
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-[#f59e0b]">
              {budgetUtilizationPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Critical Attention Banner if any project has overdue deadlines */}
      {criticalProjects.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-[#27272a] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#f43f5e]">
            <AlertTriangle className="w-3.5 h-3.5 flex-none" />
            <span>
              Внимание: выявлены задержки по дедлайнам в проектах:{' '}
              <strong className="font-semibold text-[#fafafa]">
                {criticalProjects.map((p) => p.id).join(', ')}
              </strong>
            </span>
          </div>

          {onOpenProject && (
            <button
              type="button"
              onClick={() => onOpenProject(criticalProjects[0].id)}
              className="text-[#6366f1] hover:text-[#818cf8] font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Перейти к {criticalProjects[0].id}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
