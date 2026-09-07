import { Project, ProjectExpense } from '../types';

/**
 * Parses numeric budget value from string (e.g. "2 400 000 ₽" -> 2400000)
 */
export function parseBudget(budget: string | number | undefined): number {
  if (typeof budget === 'number') return budget;
  if (!budget) return 0;
  const num = parseInt(budget.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a number to Russian currency format (e.g. 2400000 -> "2 400 000 ₽")
 */
export function formatRuCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(amount)) + ' ₽';
}

export interface ProjectBudgetStats {
  allocated: number;
  spent: number;
  remaining: number;
  percent: number;
  status: 'normal' | 'warn' | 'crit';
  isOver80: boolean;
  isOver95: boolean;
}

/**
 * Computes full budget stats for a given project
 */
export function getProjectBudgetStats(
  project: Project,
  getReadiness?: (p: Project) => number
): ProjectBudgetStats {
  const allocated = parseBudget(project.budget);

  let spent = 0;
  if (typeof project.spentBudget === 'number') {
    spent = project.spentBudget;
  } else if (project.expenses && project.expenses.length > 0) {
    spent = project.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  } else if (getReadiness) {
    // Default baseline fallback: proportional to operational milestone readiness
    const r = getReadiness(project);
    spent = Math.round(allocated * (r / 100));
  }

  const percent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
  const remaining = Math.max(0, allocated - spent);

  const isOver80 = percent >= 80;
  const isOver95 = percent >= 95;

  let status: 'normal' | 'warn' | 'crit' = 'normal';
  if (isOver95) {
    status = 'crit';
  } else if (isOver80) {
    status = 'warn';
  }

  return {
    allocated,
    spent,
    remaining,
    percent,
    status,
    isOver80,
    isOver95
  };
}

export interface BudgetAlertPayload {
  threshold: 80 | 95;
  title: string;
  message: string;
  type: 'warn' | 'bad';
  project: Project;
  percent: number;
  allocated: number;
  spent: number;
}

/**
 * Inspects a project's budget and returns any threshold alerts that should be triggered
 * based on previously alerted thresholds stored in project.alertedBudgetThresholds
 */
export function checkProjectBudgetAlerts(
  project: Project,
  currentSpent: number,
  allocated: number
): {
  alertsToTrigger: BudgetAlertPayload[];
  newAlertedThresholds: number[];
} {
  const percent = allocated > 0 ? Math.round((currentSpent / allocated) * 100) : 0;
  const currentAlerted = new Set(project.alertedBudgetThresholds || []);
  const alertsToTrigger: BudgetAlertPayload[] = [];
  const nextAlerted = new Set(currentAlerted);

  // 1. Check 95% threshold (critical)
  if (percent >= 95) {
    if (!currentAlerted.has(95)) {
      alertsToTrigger.push({
        threshold: 95,
        title: `🚨 Критический бюджет: ${project.id}`,
        message: `Проект «${project.title}» освоил ${percent}% бюджета (${formatRuCurrency(
          currentSpent
        )} из ${formatRuCurrency(allocated)}). Доступный остаток: ${formatRuCurrency(
          Math.max(0, allocated - currentSpent)
        )}.`,
        type: 'bad',
        project,
        percent,
        allocated,
        spent: currentSpent
      });
      nextAlerted.add(95);
      nextAlerted.add(80); // 95% naturally encompasses 80%
    }
  }
  // 2. Check 80% threshold (warning)
  else if (percent >= 80) {
    if (!currentAlerted.has(80)) {
      alertsToTrigger.push({
        threshold: 80,
        title: `⚠️ Превышение порога бюджета: ${project.id}`,
        message: `Проект «${project.title}» достиг 80% бюджета (${percent}%: ${formatRuCurrency(
          currentSpent
        )} из ${formatRuCurrency(allocated)}). Требуется контроль дополнительных смет.`,
        type: 'warn',
        project,
        percent,
        allocated,
        spent: currentSpent
      });
      nextAlerted.add(80);
    }
  } else {
    // If spent was decreased below 80%, reset alerted state so future increases re-trigger
    if (percent < 75) {
      nextAlerted.delete(80);
      nextAlerted.delete(95);
    } else if (percent < 90) {
      nextAlerted.delete(95);
    }
  }

  return {
    alertsToTrigger,
    newAlertedThresholds: Array.from(nextAlerted)
  };
}
