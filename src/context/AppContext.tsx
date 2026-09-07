import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AppState,
  ViewType,
  SoonKey,
  ToastItem,
  Task,
  Subtask,
  TaskAutomationRule,
  AutomationLogEntry,
  AutomationTrigger,
  AutomationAction,
  Project,
  TeamMember,
  EquipmentItem,
  ActivityItem,
  MemberOnlineStatus,
  ProjectExpense,
  EquipmentStatus
} from '../types';
import {
  getSeedState,
  D,
  daysLeft,
  fmtRu,
  getSeedActivities,
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_AUTOMATION_LOGS,
  SIMULATED_FIELD_EVENTS
} from '../data/seedData';
import { parseBudget, formatRuCurrency, checkProjectBudgetAlerts } from '../utils/budgetAlerts';
import { playSuccessChime, playRadioChirp, playAlertTone } from '../utils/soundEffects';

const STORAGE_KEY = 'profi360_hub_v1';
const SOUND_STORAGE_KEY = 'profi360_sound_v1';

interface AppContextType {
  state: AppState;
  curView: ViewType;
  switchView: (view: ViewType) => void;
  soonKey: SoonKey;
  setSoonKey: (key: SoonKey) => void;
  selectedProjectId: string | null;
  openProject: (id: string) => void;
  closeProject: () => void;
  taskFilter: { status: string; project: string; assignee: string };
  setTaskFilter: React.Dispatch<React.SetStateAction<{ status: string; project: string; assignee: string }>>;
  projFilter: 'active' | 'done' | 'all';
  setProjFilter: (f: 'active' | 'done' | 'all') => void;
  eqFilter: { cat: string; status: string };
  setEqFilter: React.Dispatch<React.SetStateAction<{ cat: string; status: string }>>;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  isNewProjectModalOpen: boolean;
  setIsNewProjectModalOpen: (open: boolean) => void;
  isNewEquipmentModalOpen: boolean;
  setIsNewEquipmentModalOpen: (open: boolean) => void;
  isNewTeamModalOpen: boolean;
  setIsNewTeamModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  isRulesModalOpen: boolean;
  setIsRulesModalOpen: (open: boolean) => void;
  toggleAutomationRule: (ruleId: string) => void;
  addAutomationRule: (rule: Omit<TaskAutomationRule, 'id' | 'triggerCount' | 'lastFiredAt'>) => void;
  deleteAutomationRule: (ruleId: string) => void;
  runRulesEngine: (manualTriggerRuleId?: string) => number;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  clearAutomationLogs: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  flashId: string | null;
  triggerFlash: (id: string) => void;
  toasts: ToastItem[];
  addToast: (message: string, type?: 'ok' | 'warn' | 'bad' | 'acc', title?: string) => void;
  dismissToast: (id: string) => void;
  dismissBanner: () => void;
  toggleTask: (id: string) => void;
  cycleTask: (id: string) => void;
  moveTask: (id: string, newStatus: Task['status'], targetIndex?: number) => void;
  addTask: (task: Omit<Task, 'id'>) => void;
  deleteTask: (id: string) => void;
  addProject: (p: {
    title: string;
    description?: string;
    client: string;
    venue: string;
    date: string;
    budget: string;
    manager: string;
  }) => void;
  checkEquipment: (id: string) => void;
  addEquipment: (eq: Omit<EquipmentItem, 'id' | 'issues'>) => void;
  updateEquipmentStatus: (id: string, status: EquipmentStatus, project?: string | null) => void;
  addTeamMember: (m: Omit<TeamMember, 'id'>) => void;
  toggleDocStatus: (id: string) => void;
  toggleCheckItem: (projectId: string, catIndex: number, itemIndex: number) => void;
  toggleDeadline: (projectId: string, deadlineIndex: number) => void;
  toggleMemberOnlineStatus: (memberId: string, newStatus?: MemberOnlineStatus) => void;
  updateProjectSpent: (projectId: string, newSpent: number) => void;
  addProjectExpense: (projectId: string, expense: Omit<ProjectExpense, 'id'>) => void;
  removeProjectExpense: (projectId: string, expenseId: string) => void;
  triggerBudgetThresholdCheck: (projectId?: string) => void;
  resetProjectBudgetAlerts: (projectId: string) => void;
  pingTeamTelemetry: () => void;
  resetDemo: () => void;
  userById: (id: string) => TeamMember | undefined;
  projById: (id: string) => Project | undefined;
  eqById: (id: string) => EquipmentItem | undefined;
  projLabel: (id: string) => string;
  isOverdue: (task: Task) => boolean;
  getReadiness: (project: Project) => number;
  activities: ActivityItem[];
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  clearActivities: () => void;
  isLiveFeedActive: boolean;
  setIsLiveFeedActive: React.Dispatch<React.SetStateAction<boolean>>;
  simulateFieldEvent: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.activities || !Array.isArray(parsed.activities)) {
          parsed.activities = getSeedActivities();
        }
        if (parsed.team && Array.isArray(parsed.team)) {
          const seed = getSeedState();
          parsed.team = parsed.team.map((m: TeamMember) => {
            const seedM = seed.team.find((s) => s.id === m.id);
            return {
              ...m,
              onlineStatus: m.onlineStatus || seedM?.onlineStatus || 'online',
              lastSeen: m.lastSeen || seedM?.lastSeen || 'В сети',
              device: m.device || seedM?.device || 'mobile',
              location: m.location || seedM?.location || 'Штаб'
            };
          });
        }
        if (parsed.projects && Array.isArray(parsed.projects)) {
          const seed = getSeedState();
          parsed.projects = parsed.projects.map((p: Project) => {
            const seedP = seed.projects.find((s) => s.id === p.id);
            return {
              ...p,
              description: p.description || seedP?.description || '',
              spentBudget: typeof p.spentBudget === 'number' ? p.spentBudget : (seedP?.spentBudget ?? 0),
              expenses: p.expenses || seedP?.expenses || [],
              alertedBudgetThresholds: p.alertedBudgetThresholds || seedP?.alertedBudgetThresholds || []
            };
          });
        }
        const seed = getSeedState();
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          parsed.tasks = parsed.tasks.map((t: Task) => {
            const seedT = seed.tasks.find((s) => s.id === t.id);
            return {
              ...t,
              subtasks: t.subtasks || seedT?.subtasks || []
            };
          });
        }
        if (!parsed.automationRules || !Array.isArray(parsed.automationRules)) {
          parsed.automationRules = seed.automationRules || DEFAULT_AUTOMATION_RULES;
        }
        if (!parsed.automationLogs || !Array.isArray(parsed.automationLogs)) {
          parsed.automationLogs = seed.automationLogs || DEFAULT_AUTOMATION_LOGS;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return getSeedState();
  });

  const [curView, setCurView] = useState<ViewType>('hub');
  const [soonKey, setSoonKey] = useState<SoonKey>('kb');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState({ status: 'open', project: 'all', assignee: 'all' });
  const [projFilter, setProjFilter] = useState<'active' | 'done' | 'all'>('active');
  const [eqFilter, setEqFilter] = useState({ cat: 'all', status: 'all' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isNewEquipmentModalOpen, setIsNewEquipmentModalOpen] = useState(false);
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isLiveFeedActive, setIsLiveFeedActive] = useState<boolean>(true);
  const [simIdx, setSimIdx] = useState<number>(0);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {}
      if (next) {
        playRadioChirp();
      }
      return next;
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsOpen(false);
        setIsModalOpen(false);
        setIsNewProjectModalOpen(false);
        setIsNewEquipmentModalOpen(false);
        setIsNewTeamModalOpen(false);
      } else if (e.key === '1') {
        setCurView('hub');
      } else if (e.key === '2') {
        setCurView('projects');
      } else if (e.key === '3') {
        setCurView('tasks');
      } else if (e.key === '4') {
        setCurView('equipment');
      } else if (e.key === '5') {
        setCurView('team');
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        setIsModalOpen(true);
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
        e.preventDefault();
        setIsNewProjectModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable
    }
  }, [state]);

  const addActivity = (act: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newAct: ActivityItem = {
      ...act,
      id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now()
    };
    setState((prev) => ({
      ...prev,
      activities: [newAct, ...(prev.activities || [])].slice(0, 60)
    }));
  };

  const clearActivities = () => {
    setState((prev) => ({ ...prev, activities: [] }));
  };

  const simulateFieldEvent = () => {
    const ev = SIMULATED_FIELD_EVENTS[simIdx % SIMULATED_FIELD_EVENTS.length];
    setSimIdx((i) => i + 1);
    addActivity(ev);
    addToast(`Новое событие: ${ev.title}`, ev.badgeType === 'crit' ? 'bad' : ev.badgeType === 'warn' ? 'warn' : 'ok');
  };

  // Real-time automatic field updates simulation
  useEffect(() => {
    if (!isLiveFeedActive) return;
    const interval = setInterval(() => {
      setSimIdx((curr) => {
        const ev = SIMULATED_FIELD_EVENTS[curr % SIMULATED_FIELD_EVENTS.length];
        addActivity(ev);
        return curr + 1;
      });
    }, 40000);
    return () => clearInterval(interval);
  }, [isLiveFeedActive]);

  // Automated background evaluation of project budget thresholds (80% and 95%)
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => {
        let hasAlerts = false;
        const newActivities: ActivityItem[] = [];

        const updatedProjects = prev.projects.map((p) => {
          if (p.status === 'done') return p;
          const allocated = parseBudget(p.budget);
          const currentSpent =
            typeof p.spentBudget === 'number'
              ? p.spentBudget
              : p.expenses && p.expenses.length > 0
              ? p.expenses.reduce((s, e) => s + e.amount, 0)
              : Math.round(allocated * (getReadiness(p) / 100));

          const { alertsToTrigger, newAlertedThresholds } = checkProjectBudgetAlerts(
            p,
            currentSpent,
            allocated
          );

          if (alertsToTrigger.length > 0) {
            hasAlerts = true;
            alertsToTrigger.forEach((alert) => {
              addToast(alert.message, alert.type, alert.title);
              newActivities.push({
                id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
                type: 'project',
                title:
                  alert.threshold === 95
                    ? '🚨 Порог 95% бюджета превышен'
                    : '⚠️ Порог 80% бюджета достигнут',
                detail: alert.message,
                timestamp: Date.now(),
                actor: 'Контроль смет',
                actorRole: 'Штаб',
                badgeType: alert.type === 'bad' ? 'crit' : 'warn',
                target: { type: 'project', id: p.id }
              });
            });

            return {
              ...p,
              spentBudget: currentSpent,
              alertedBudgetThresholds: newAlertedThresholds
            };
          }

          return p;
        });

        if (!hasAlerts) return prev;

        return {
          ...prev,
          projects: updatedProjects,
          activities: [...newActivities, ...(prev.activities || [])].slice(0, 60)
        };
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const addToast = (
    message: string,
    type: 'ok' | 'warn' | 'bad' | 'acc' = 'ok',
    title?: string
  ) => {
    if (soundEnabled) {
      if (type === 'bad' || type === 'warn') {
        playAlertTone();
      } else if (type === 'acc') {
        playRadioChirp();
      } else {
        playSuccessChime();
      }
    }
    const id = 'toast_' + Date.now() + Math.random().toString(36).slice(2, 5);
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const triggerFlash = (id: string) => {
    setFlashId(id);
    setTimeout(() => {
      setFlashId(null);
    }, 1800);
  };

  const switchView = (view: ViewType) => {
    setCurView(view);
    setMobileMenuOpen(false);
  };

  const openProject = (id: string) => {
    setSelectedProjectId(id);
  };

  const closeProject = () => {
    setSelectedProjectId(null);
  };

  const dismissBanner = () => {
    setState((prev) => ({ ...prev, banner: false }));
  };

  const toggleTask = (id: string) => {
    setState((prev) => {
      const targetTask = prev.tasks.find((x) => x.id === id);
      const isNowDone = targetTask?.status !== 'done';
      const updated = prev.tasks.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'done' ? 'inwork' : 'done';
          return { ...t, status: nextStatus as Task['status'] };
        }
        return t;
      });
      addToast(isNowDone ? '✓ Задача выполнена' : 'Задача возвращена в работу', isNowDone ? 'ok' : 'acc');
      
      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'task',
        title: isNowDone ? 'Задача выполнена' : 'Задача возвращена в работу',
        detail: `«${targetTask?.title || id}» · отв. ${prev.team.find(u => u.id === targetTask?.assignee)?.name || 'Команда'}`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: isNowDone ? 'ok' : 'info',
        target: { type: 'task', id }
      };

      return {
        ...prev,
        tasks: updated,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const cycleTask = (id: string) => {
    setState((prev) => {
      const targetTask = prev.tasks.find((x) => x.id === id);
      const cycle: Record<string, Task['status']> = {
        todo: 'inwork',
        inwork: 'done',
        done: 'todo'
      };
      const nextStatus = targetTask ? cycle[targetTask.status] : 'inwork';
      const statusLabels: Record<string, string> = {
        todo: 'К выполнению',
        inwork: 'В работе',
        done: 'Завершена'
      };

      const updated = prev.tasks.map((t) => {
        if (t.id === id) {
          return { ...t, status: nextStatus };
        }
        return t;
      });

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'task',
        title: `Статус задачи: ${statusLabels[nextStatus]}`,
        detail: `«${targetTask?.title || id}»`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: nextStatus === 'done' ? 'ok' : 'info',
        target: { type: 'task', id }
      };

      return {
        ...prev,
        tasks: updated,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const moveTask = (id: string, newStatus: Task['status'], targetIndex?: number) => {
    setState((prev) => {
      const targetTask = prev.tasks.find((x) => x.id === id);
      if (!targetTask) return prev;

      const oldStatus = targetTask.status;
      const statusChanged = oldStatus !== newStatus;

      const statusLabels: Record<Task['status'], string> = {
        todo: 'К выполнению',
        inwork: 'В работе',
        done: 'Завершена'
      };

      const remainingTasks = prev.tasks.filter((t) => t.id !== id);
      const updatedTask: Task = { ...targetTask, status: newStatus };

      let updatedTasks: Task[];
      if (targetIndex !== undefined) {
        const columnTasks = remainingTasks.filter((t) => t.status === newStatus);
        const otherTasks = remainingTasks.filter((t) => t.status !== newStatus);

        const clampedIndex = Math.max(0, Math.min(targetIndex, columnTasks.length));
        columnTasks.splice(clampedIndex, 0, updatedTask);

        updatedTasks = [...columnTasks, ...otherTasks];
      } else {
        const columnTasks = remainingTasks.filter((t) => t.status === newStatus);
        const otherTasks = remainingTasks.filter((t) => t.status !== newStatus);
        updatedTasks = [updatedTask, ...columnTasks, ...otherTasks];
      }

      if (statusChanged) {
        const isNowDone = newStatus === 'done';
        addToast(
          isNowDone
            ? '✓ Задача выполнена'
            : `Задача перемещена: «${statusLabels[newStatus]}»`,
          isNowDone ? 'ok' : 'acc'
        );

        const newAct: ActivityItem = {
          id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
          type: 'task',
          title: `Перемещение задачи: ${statusLabels[newStatus]}`,
          detail: `«${targetTask.title}» перенесена в «${statusLabels[newStatus]}»`,
          timestamp: Date.now(),
          actor: 'Диспетчер (вы)',
          actorRole: 'Штаб',
          badgeType: isNowDone ? 'ok' : 'info',
          target: { type: 'task', id }
        };

        return {
          ...prev,
          tasks: updatedTasks,
          activities: [newAct, ...(prev.activities || [])].slice(0, 60)
        };
      }

      return {
        ...prev,
        tasks: updatedTasks
      };
    });
  };

  const addTask = (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: 't' + Date.now()
    };
    const newAct: ActivityItem = {
      id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
      type: 'task',
      title: 'Создана новая задача',
      detail: `«${taskData.title}» · проект ${taskData.project === 'base' ? 'Склад / база' : taskData.project} · срок ${fmtRu(taskData.due)}`,
      timestamp: Date.now(),
      actor: 'Диспетчер (вы)',
      actorRole: 'Штаб',
      badgeType: 'info',
      target: { type: 'task', id: newTask.id }
    };

    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
      activities: [newAct, ...(prev.activities || [])].slice(0, 60)
    }));
    addToast('✓ Задача создана и добавлена в штаб', 'acc');
  };

  const deleteTask = (id: string) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === id);
      if (!target) return prev;
      const updated = prev.tasks.filter((t) => t.id !== id);
      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'task',
        title: 'Удалена задача',
        detail: `«${target.title}» снята с контроля`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: 'warn',
        target: { type: 'task', id }
      };
      addToast(`Задача «${target.title}» удалена`, 'warn');
      return {
        ...prev,
        tasks: updated,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const toggleAutomationRule = (ruleId: string) => {
    setState((prev) => {
      const currentRules = prev.automationRules || DEFAULT_AUTOMATION_RULES;
      const target = currentRules.find((r) => r.id === ruleId);
      if (!target) return prev;
      const nextEnabled = !target.enabled;
      const updatedRules = currentRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: nextEnabled } : r
      );
      addToast(
        `Правило «${target.name}» ${nextEnabled ? 'активировано (ВКЛ)' : 'приостановлено (ВЫКЛ)'}`,
        nextEnabled ? 'ok' : 'acc'
      );
      return {
        ...prev,
        automationRules: updatedRules
      };
    });
  };

  const addAutomationRule = (
    ruleData: Omit<TaskAutomationRule, 'id' | 'triggerCount' | 'lastFiredAt'>
  ) => {
    const newRule: TaskAutomationRule = {
      ...ruleData,
      id: 'rule_' + Date.now() + Math.random().toString(36).slice(2, 5),
      triggerCount: 0,
      isDefault: false
    };
    setState((prev) => ({
      ...prev,
      automationRules: [...(prev.automationRules || DEFAULT_AUTOMATION_RULES), newRule]
    }));
    addToast(`✓ Новое правило «${ruleData.name}» добавлено в систему`, 'ok');
  };

  const deleteAutomationRule = (ruleId: string) => {
    setState((prev) => {
      const currentRules = prev.automationRules || DEFAULT_AUTOMATION_RULES;
      return {
        ...prev,
        automationRules: currentRules.filter((r) => r.id !== ruleId)
      };
    });
    addToast('Правило автоматизации удалено', 'warn');
  };

  const clearAutomationLogs = () => {
    setState((prev) => ({
      ...prev,
      automationLogs: []
    }));
    addToast('Журнал срабатывания правил очищен', 'acc');
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setState((prev) => {
      const targetTask = prev.tasks.find((t) => t.id === taskId);
      if (!targetTask || !targetTask.subtasks) return prev;

      let subtaskTitle = '';
      let subtaskNextDone = false;

      const updatedSubtasks: Subtask[] = targetTask.subtasks.map((st) => {
        if (st.id === subtaskId) {
          subtaskTitle = st.title;
          subtaskNextDone = !st.done;
          return { ...st, done: subtaskNextDone };
        }
        return st;
      });

      const totalCount = updatedSubtasks.length;
      const doneCount = updatedSubtasks.filter((s) => s.done).length;
      const allDone = totalCount > 0 && doneCount === totalCount;
      const anyDone = doneCount > 0;

      // Check active automation rules
      const activeRules = (prev.automationRules || DEFAULT_AUTOMATION_RULES).filter((r) => r.enabled);
      const autoDoneRule = activeRules.find(
        (r) =>
          r.trigger === 'all_subtasks_checked' &&
          r.action === 'move_to_done' &&
          (r.projectFilter === 'all' || !r.projectFilter || r.projectFilter === targetTask.project)
      );

      const autoInworkRule = activeRules.find(
        (r) =>
          r.trigger === 'first_subtask_checked' &&
          r.action === 'move_to_inwork' &&
          (r.projectFilter === 'all' || !r.projectFilter || r.projectFilter === targetTask.project)
      );

      let nextTaskStatus = targetTask.status;
      const newLogs: AutomationLogEntry[] = [];
      const newActivities: ActivityItem[] = [];
      const updatedRules = [...(prev.automationRules || DEFAULT_AUTOMATION_RULES)];

      // Trigger: All subtasks completed -> automatically Move to Done!
      if (allDone && targetTask.status !== 'done' && autoDoneRule) {
        nextTaskStatus = 'done';

        const ruleIdx = updatedRules.findIndex((r) => r.id === autoDoneRule.id);
        if (ruleIdx !== -1) {
          updatedRules[ruleIdx] = {
            ...updatedRules[ruleIdx],
            triggerCount: (updatedRules[ruleIdx].triggerCount || 0) + 1,
            lastFiredAt: Date.now()
          };
        }

        newLogs.push({
          id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
          ruleId: autoDoneRule.id,
          ruleName: autoDoneRule.name,
          taskId: targetTask.id,
          taskTitle: targetTask.title,
          actionTaken: `Все подзадачи (${totalCount}/${totalCount}) выполнены → Задача автоматически переведена в «Выполнено»`,
          timestamp: Date.now(),
          badge: 'ok'
        });

        newActivities.push({
          id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
          type: 'task',
          title: '⚡ Автоматизация: задача выполнена',
          detail: `Все подзадачи чеклиста закрыты: «${targetTask.title}» переведена в «Выполнено»`,
          timestamp: Date.now(),
          actor: 'Движок правил',
          actorRole: 'Rules Engine',
          badgeType: 'ok',
          target: { type: 'task', id: taskId }
        });

        addToast(
          `⚡ Правило «${autoDoneRule.name}»: все подзадачи выполнены → Задача «${targetTask.title}» переведена в «Выполнено»`,
          'ok',
          'Автозавершение по подзадачам'
        );
      } else if (anyDone && !allDone && targetTask.status === 'todo' && autoInworkRule) {
        // Trigger: First subtask completed -> Move to inwork
        nextTaskStatus = 'inwork';

        const ruleIdx = updatedRules.findIndex((r) => r.id === autoInworkRule.id);
        if (ruleIdx !== -1) {
          updatedRules[ruleIdx] = {
            ...updatedRules[ruleIdx],
            triggerCount: (updatedRules[ruleIdx].triggerCount || 0) + 1,
            lastFiredAt: Date.now()
          };
        }

        newLogs.push({
          id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
          ruleId: autoInworkRule.id,
          ruleName: autoInworkRule.name,
          taskId: targetTask.id,
          taskTitle: targetTask.title,
          actionTaken: `Начато выполнение подзадач (${doneCount}/${totalCount}) → Задача переведена в «В работе»`,
          timestamp: Date.now(),
          badge: 'info'
        });

        newActivities.push({
          id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
          type: 'task',
          title: '⚡ Автоматизация: задача взята в работу',
          detail: `Выполнена подзадача: «${targetTask.title}» переведена «В работу»`,
          timestamp: Date.now(),
          actor: 'Движок правил',
          actorRole: 'Rules Engine',
          badgeType: 'info',
          target: { type: 'task', id: taskId }
        });

        addToast(
          `⚡ Автоматизация: Первая подзадача выполнена → Задача «${targetTask.title}» переведена «В работу»`,
          'acc'
        );
      } else {
        addToast(
          subtaskNextDone ? `✓ Подзадача: ${subtaskTitle}` : `○ Подзадача возвращена: ${subtaskTitle}`,
          subtaskNextDone ? 'ok' : 'acc'
        );
      }

      const updatedTasks: Task[] = prev.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: nextTaskStatus,
            subtasks: updatedSubtasks
          };
        }
        return t;
      });

      return {
        ...prev,
        tasks: updatedTasks,
        automationRules: updatedRules,
        automationLogs: [...newLogs, ...(prev.automationLogs || [])].slice(0, 100),
        activities: [...newActivities, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const addSubtask = (taskId: string, title: string) => {
    if (!title.trim()) return;
    setState((prev) => {
      const updated = prev.tasks.map((t) => {
        if (t.id === taskId) {
          const current = t.subtasks || [];
          const newSt: Subtask = {
            id: 'st_' + Date.now() + Math.random().toString(36).slice(2, 5),
            title: title.trim(),
            done: false
          };
          return {
            ...t,
            subtasks: [...current, newSt]
          };
        }
        return t;
      });
      return {
        ...prev,
        tasks: updated
      };
    });
    addToast('Подзадача добавлена к чеклисту', 'ok');
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    setState((prev) => {
      const updated = prev.tasks.map((t) => {
        if (t.id === taskId && t.subtasks) {
          return {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== subtaskId)
          };
        }
        return t;
      });
      return {
        ...prev,
        tasks: updated
      };
    });
  };

  const runRulesEngine = (manualTriggerRuleId?: string): number => {
    let triggeredCount = 0;

    setState((prev) => {
      const activeRules = (prev.automationRules || DEFAULT_AUTOMATION_RULES).filter(
        (r) => (manualTriggerRuleId ? r.id === manualTriggerRuleId : r.enabled)
      );

      if (activeRules.length === 0) {
        addToast('Нет активных правил для выполнения', 'warn');
        return prev;
      }

      let updatedTasks = [...prev.tasks];
      let updatedRules = [...(prev.automationRules || DEFAULT_AUTOMATION_RULES)];
      const newLogs: AutomationLogEntry[] = [];
      const newActivities: ActivityItem[] = [];
      let updatedAlerts = [...prev.alerts];

      // 1. Process Overdue -> Notify PM Rule
      const overduePmRules = activeRules.filter(
        (r) => r.trigger === 'deadline_overdue' && r.action === 'notify_pm'
      );

      if (overduePmRules.length > 0) {
        overduePmRules.forEach((rule) => {
          const overdueTasks = updatedTasks.filter((t) => {
            if (t.status === 'done') return false;
            if (!isOverdue(t)) return false;
            if (rule.projectFilter && rule.projectFilter !== 'all' && t.project !== rule.projectFilter) return false;
            if (rule.priorityFilter && rule.priorityFilter !== 'all' && t.prio !== rule.priorityFilter) return false;
            return true;
          });

          overdueTasks.forEach((task) => {
            const project = prev.projects.find((p) => p.id === task.project);
            const pmName = project?.manager || (task.project === 'base' ? 'Диспетчер склада' : 'Руководитель проекта');
            const overdueDays = Math.abs(daysLeft(task.due));
            const alertText = `🚨 Просрочен дедлайн задачи «${task.title}»`;

            const existingAlert = updatedAlerts.some((a) => a.text === alertText);
            if (!existingAlert) {
              updatedAlerts = [
                {
                  sev: 'crit',
                  text: alertText,
                  sub: `Срок истек ${overdueDays} дн. назад · РП: ${pmName} · Проект: ${project?.title || task.project}`,
                  go: { type: 'project', id: task.project }
                },
                ...updatedAlerts
              ];
            }

            updatedTasks = updatedTasks.map((t) =>
              t.id === task.id ? { ...t, notifiedPmOverdue: true } : t
            );

            newLogs.push({
              id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
              ruleId: rule.id,
              ruleName: rule.name,
              taskId: task.id,
              taskTitle: task.title,
              actionTaken: `Дедлайн просрочен на ${overdueDays} дн. → Руководитель проекта (${pmName}) уведомлен, сформирован критический алерт в штаб`,
              timestamp: Date.now(),
              badge: 'crit',
              targetManager: pmName
            });

            newActivities.push({
              id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
              type: 'task',
              title: `🚨 Оповещение РП: просрочка дедлайна`,
              detail: `Задача «${task.title}» (${task.project}) просрочена на ${overdueDays} дн. Направлен алерт РП: ${pmName}`,
              timestamp: Date.now(),
              actor: 'Движок автоматизации',
              actorRole: 'PM Alert Dispatcher',
              badgeType: 'crit',
              target: { type: 'project', id: task.project }
            });

            addToast(
              `🔔 РП ${pmName} уведомлен: Задача «${task.title}» просрочена на ${overdueDays} дн.`,
              'bad',
              `Оповещение РП (${task.project})`
            );

            triggeredCount++;

            const rIdx = updatedRules.findIndex((r) => r.id === rule.id);
            if (rIdx !== -1) {
              updatedRules[rIdx] = {
                ...updatedRules[rIdx],
                triggerCount: (updatedRules[rIdx].triggerCount || 0) + 1,
                lastFiredAt: Date.now()
              };
            }
          });
        });
      }

      // 2. Process Subtasks -> Move to Done Rule
      const subtaskDoneRules = activeRules.filter(
        (r) => r.trigger === 'all_subtasks_checked' && r.action === 'move_to_done'
      );

      if (subtaskDoneRules.length > 0) {
        subtaskDoneRules.forEach((rule) => {
          const eligibleTasks = updatedTasks.filter((t) => {
            if (t.status === 'done') return false;
            if (!t.subtasks || t.subtasks.length === 0) return false;
            if (rule.projectFilter && rule.projectFilter !== 'all' && t.project !== rule.projectFilter) return false;
            return t.subtasks.every((s) => s.done);
          });

          eligibleTasks.forEach((task) => {
            updatedTasks = updatedTasks.map((t) =>
              t.id === task.id ? { ...t, status: 'done' } : t
            );

            newLogs.push({
              id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
              ruleId: rule.id,
              ruleName: rule.name,
              taskId: task.id,
              taskTitle: task.title,
              actionTaken: `Все подзадачи закрыты → Задача автоматически перемещена в «Выполнено»`,
              timestamp: Date.now(),
              badge: 'ok'
            });

            newActivities.push({
              id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
              type: 'task',
              title: '⚡ Автоматизация: задача выполнена',
              detail: `«${task.title}» переведена в «Выполнено» по правилу «${rule.name}»`,
              timestamp: Date.now(),
              actor: 'Движок правил',
              actorRole: 'Rules Engine',
              badgeType: 'ok',
              target: { type: 'task', id: task.id }
            });

            addToast(
              `⚡ Автоматизация: Все подзадачи закрыты → Задача «${task.title}» переведена в «Выполнено»`,
              'ok'
            );

            triggeredCount++;

            const rIdx = updatedRules.findIndex((r) => r.id === rule.id);
            if (rIdx !== -1) {
              updatedRules[rIdx] = {
                ...updatedRules[rIdx],
                triggerCount: (updatedRules[rIdx].triggerCount || 0) + 1,
                lastFiredAt: Date.now()
              };
            }
          });
        });
      }

      // 3. Process High Priority Overdue Escalation
      const escalateRules = activeRules.filter(
        (r) => r.trigger === 'high_prio_overdue' && r.action === 'create_alert'
      );

      if (escalateRules.length > 0) {
        escalateRules.forEach((rule) => {
          const highPrioOverdueTasks = updatedTasks.filter((t) => {
            if (t.status === 'done') return false;
            if (t.prio !== 'high') return false;
            if (!isOverdue(t)) return false;
            return true;
          });

          highPrioOverdueTasks.forEach((task) => {
            const overdueDays = Math.abs(daysLeft(task.due));
            const alertText = `🚨 Критическая просрочка High Priority: «${task.title}»`;
            if (!updatedAlerts.some((a) => a.text === alertText)) {
              updatedAlerts = [
                {
                  sev: 'crit',
                  text: alertText,
                  sub: `Просрочено на ${overdueDays} дн. · Требуется экстренное вмешательство штаба`,
                  go: { type: 'project', id: task.project }
                },
                ...updatedAlerts
              ];

              newLogs.push({
                id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
                ruleId: rule.id,
                ruleName: rule.name,
                taskId: task.id,
                taskTitle: task.title,
                actionTaken: `High Priority задача просрочена на ${overdueDays} дн. → Экстренная эскалация в штаб`,
                timestamp: Date.now(),
                badge: 'crit'
              });

              triggeredCount++;
            }
          });
        });
      }

      if (triggeredCount === 0) {
        addToast('✓ Все задачи проверены: новых триггеров не зафиксировано', 'acc');
      } else {
        addToast(`⚡ Сработало автоматических триггеров: ${triggeredCount}`, 'ok', 'Движок правил');
      }

      return {
        ...prev,
        tasks: updatedTasks,
        alerts: updatedAlerts,
        automationRules: updatedRules,
        automationLogs: [...newLogs, ...(prev.automationLogs || [])].slice(0, 100),
        activities: [...newActivities, ...(prev.activities || [])].slice(0, 60)
      };
    });

    return triggeredCount;
  };

  const addProject = (projectData: {
    title: string;
    description?: string;
    client: string;
    venue: string;
    date: string;
    budget: string;
    manager: string;
  }) => {
    const nextNum = 2600 + state.projects.length + 1;
    const newId = `P-${nextNum}`;
    const newProject: Project = {
      id: newId,
      title: projectData.title.trim(),
      description: projectData.description?.trim() || '',
      client: projectData.client.trim() || 'Корпоративный заказчик',
      venue: projectData.venue.trim() || 'Площадка объекта',
      date: projectData.date || D(14),
      budget: projectData.budget || '1 500 000 ₽',
      spentBudget: 0,
      expenses: [],
      alertedBudgetThresholds: [],
      manager: projectData.manager || state.team[0]?.name || 'Диспетчер',
      img: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      breakdown: {
        team: 25,
        equipment: 20,
        logistics: 15,
        content: 10,
        documents: 30
      },
      teamIds: [state.team[0]?.id || 'u1', state.team[1]?.id || 'u2'],
      eqIds: [state.equipment[0]?.id || 'eq1'],
      deadlines: [
        { t: 'Утверждение технического райдера и спецификации', due: D(3), done: false },
        { t: 'Финальный монтаж, заезд техников и саундчек', due: D(12), done: false }
      ],
      checks: [
        {
          cat: 'Звук и свет',
          items: [
            { t: 'Калибровка линейного массива и сабвуферов', done: false },
            { t: 'Патчинг DMX потоков и адресация приборов', done: false }
          ]
        },
        {
          cat: 'Безопасность',
          items: [
            { t: 'Инструктаж площадки и журнал ТБ', done: true },
            { t: 'Акт допуска электроподключения к щитовой', done: false }
          ]
        }
      ]
    };

    const newAct: ActivityItem = {
      id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
      type: 'project',
      title: 'Создан новый проект',
      detail: `${newId} · «${newProject.title}» (${newProject.client}) · смета ${newProject.budget}`,
      timestamp: Date.now(),
      actor: 'Диспетчер (вы)',
      actorRole: 'Штаб',
      badgeType: 'ok',
      target: { type: 'project', id: newId }
    };

    setState((prev) => ({
      ...prev,
      projects: [newProject, ...prev.projects],
      activities: [newAct, ...(prev.activities || [])].slice(0, 60)
    }));

    addToast(`✓ Проект ${newId} «${newProject.title}» открыт`, 'ok');
  };

  const addEquipment = (eqData: Omit<EquipmentItem, 'id' | 'issues'>) => {
    const newId = 'EQ-' + (1000 + state.equipment.length + 1);
    const newEq: EquipmentItem = {
      ...eqData,
      id: newId,
      issues: 0
    };
    const newAct: ActivityItem = {
      id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
      type: 'equipment',
      title: 'Оборудование принято на склад',
      detail: `${newId}: «${newEq.name}» (${newEq.cat}) · статус: ${newEq.status}`,
      timestamp: Date.now(),
      actor: 'Диспетчер (вы)',
      actorRole: 'Склад',
      badgeType: 'ok',
      target: { type: 'equipment', id: newId }
    };

    setState((prev) => ({
      ...prev,
      equipment: [newEq, ...prev.equipment],
      activities: [newAct, ...(prev.activities || [])].slice(0, 60)
    }));

    addToast(`✓ Оборудование «${newEq.name}» (${newId}) оприходовано`, 'ok');
  };

  const updateEquipmentStatus = (id: string, newStatus: EquipmentStatus, project?: string | null) => {
    setState((prev) => {
      const target = prev.equipment.find((e) => e.id === id);
      if (!target) return prev;

      const statusLabels: Record<EquipmentStatus, string> = {
        stock: 'На складе',
        project: 'На проекте',
        repair: 'В ремонте',
        reserved: 'В резерве',
        transit: 'В пути'
      };

      const updated = prev.equipment.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            status: newStatus,
            project: project !== undefined ? project : newStatus === 'stock' ? null : e.project
          };
        }
        return e;
      });

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'equipment',
        title: `Статус оборудования: ${statusLabels[newStatus]}`,
        detail: `${target.name} (${target.id}) переведено в «${statusLabels[newStatus]}»`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Склад',
        badgeType: newStatus === 'repair' ? 'warn' : newStatus === 'stock' ? 'ok' : 'info',
        target: { type: 'equipment', id }
      };

      addToast(`${target.name}: статус «${statusLabels[newStatus]}»`, newStatus === 'repair' ? 'warn' : 'ok');

      return {
        ...prev,
        equipment: updated,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const addTeamMember = (memberData: Omit<TeamMember, 'id'>) => {
    const newId = 'u' + (state.team.length + 1);
    const newMember: TeamMember = {
      ...memberData,
      id: newId,
      onlineStatus: memberData.onlineStatus || 'online',
      lastSeen: 'В сети · только что добавлен'
    };

    const newAct: ActivityItem = {
      id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
      type: 'team',
      title: 'В команду зачислен специалист',
      detail: `${newMember.name} · ${newMember.role} (${newMember.location || 'База'})`,
      timestamp: Date.now(),
      actor: 'Диспетчер (вы)',
      actorRole: 'Штаб',
      badgeType: 'ok',
      target: { type: 'team', id: newId }
    };

    setState((prev) => ({
      ...prev,
      team: [...prev.team, newMember],
      activities: [newAct, ...(prev.activities || [])].slice(0, 60)
    }));

    addToast(`✓ Специалист ${newMember.name} добавлен в штат`, 'ok');
  };

  const toggleDocStatus = (id: string) => {
    setState((prev) => {
      const doc = prev.docs.find((d) => d.id === id);
      if (!doc) return prev;

      // missing -> approval -> ok -> approval
      const nextStatus = doc.status === 'missing' ? 'approval' : doc.status === 'approval' ? 'ok' : 'approval';
      const statusLabels = {
        ok: 'Согласован / Готов',
        approval: 'На согласовании',
        missing: 'Отсутствует'
      };

      const updatedDocs = prev.docs.map((d) => (d.id === id ? { ...d, status: nextStatus } : d));

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'doc',
        title: `Документ: ${statusLabels[nextStatus]}`,
        detail: `«${doc.name}» [${doc.project || 'Общий'}] переведен в статус «${statusLabels[nextStatus]}»`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Документооборот',
        badgeType: nextStatus === 'ok' ? 'ok' : nextStatus === 'approval' ? 'warn' : 'crit'
      };

      addToast(
        nextStatus === 'ok'
          ? `✓ Документ «${doc.name}» согласован`
          : `Документ «${doc.name}»: статус [${statusLabels[nextStatus]}]`,
        nextStatus === 'ok' ? 'ok' : 'warn'
      );

      return {
        ...prev,
        docs: updatedDocs,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const checkEquipment = (id: string) => {
    setState((prev) => {
      const q = prev.equipment.find((x) => x.id === id);
      const updated = prev.equipment.map((item) => {
        if (item.id === id) {
          return { ...item, lastCheck: D(0), note: '' };
        }
        return item;
      });
      addToast(`✓ Проверка зафиксирована: ${q?.name || ''}`, 'acc');

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'equipment',
        title: 'Зафиксировано плановое ТО',
        detail: `${q?.name || 'Оборудование'} (${q?.cat}) — проверка подтверждена`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: 'ok',
        target: { type: 'equipment', id }
      };

      return {
        ...prev,
        equipment: updated,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const toggleCheckItem = (projectId: string, catIndex: number, itemIndex: number) => {
    setState((prev) => {
      let isDoneNow = false;
      let itemName = '';
      let catName = '';
      const updatedProjects = prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        const newChecks = p.checks.map((cat, ci) => {
          if (ci !== catIndex) return cat;
          catName = cat.cat;
          const newItems = cat.items.map((item, ii) => {
            if (ii !== itemIndex) return item;
            isDoneNow = !item.done;
            itemName = item.t;
            return { ...item, done: !item.done };
          });
          return { ...cat, items: newItems };
        });
        return { ...p, checks: newChecks };
      });
      addToast(isDoneNow ? '✓ Пункт чек-листа закрыт' : 'Пункт чек-листа открыт', 'ok');

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'project',
        title: isDoneNow ? 'Пункт чек-листа выполнен' : 'Пункт чек-листа открыт',
        detail: `${projectId}: [${catName}] ${itemName}`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: isDoneNow ? 'ok' : 'warn',
        target: { type: 'project', id: projectId }
      };

      return {
        ...prev,
        projects: updatedProjects,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const toggleDeadline = (projectId: string, deadlineIndex: number) => {
    setState((prev) => {
      let isDoneNow = false;
      let dlTitle = '';
      const updatedProjects = prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        const newDl = p.deadlines.map((dl, di) => {
          if (di !== deadlineIndex) return dl;
          isDoneNow = !dl.done;
          dlTitle = dl.t;
          return { ...dl, done: !dl.done };
        });
        return { ...p, deadlines: newDl };
      });
      addToast(isDoneNow ? '✓ Дедлайн отмечен выполненным' : 'Дедлайн снова открыт', 'ok');

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'project',
        title: isDoneNow ? 'Дедлайн закрыт' : 'Дедлайн открыт заново',
        detail: `${projectId}: «${dlTitle}»`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: isDoneNow ? 'ok' : 'warn',
        target: { type: 'project', id: projectId }
      };

      return {
        ...prev,
        projects: updatedProjects,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const toggleMemberOnlineStatus = (memberId: string, newStatus?: MemberOnlineStatus) => {
    setState((prev) => {
      let memberName = '';
      let targetStatus: MemberOnlineStatus = 'online';

      const updatedTeam = prev.team.map((m) => {
        if (m.id !== memberId) return m;
        memberName = m.name;
        const current = m.onlineStatus || 'online';
        if (newStatus) {
          targetStatus = newStatus;
        } else {
          targetStatus = current === 'online' ? 'busy' : current === 'busy' ? 'offline' : 'online';
        }

        const lastSeenText =
          targetStatus === 'online'
            ? 'В сети · сейчас'
            : targetStatus === 'busy'
            ? 'На площадке / В работе'
            : 'Офлайн · смена закрыта';

        return {
          ...m,
          onlineStatus: targetStatus,
          lastSeen: lastSeenText
        };
      });

      const statusActBadge: Record<MemberOnlineStatus, 'ok' | 'warn' | 'crit'> = {
        online: 'ok',
        busy: 'warn',
        offline: 'crit'
      };

      const statusToastType: Record<MemberOnlineStatus, 'ok' | 'warn' | 'bad'> = {
        online: 'ok',
        busy: 'warn',
        offline: 'bad'
      };

      const statusTitle: Record<MemberOnlineStatus, string> = {
        online: 'Сотрудник в сети',
        busy: 'Сотрудник на площадке / занят',
        offline: 'Сотрудник ушел в офлайн'
      };

      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'team',
        title: statusTitle[targetStatus],
        detail: `${memberName}: статус связи изменен на [${
          targetStatus === 'online' ? 'Онлайн' : targetStatus === 'busy' ? 'На площадке' : 'Офлайн'
        }]`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб связи',
        badgeType: statusActBadge[targetStatus],
        target: { type: 'team', id: memberId }
      };

      addToast(
        `${memberName}: ${
          targetStatus === 'online'
            ? '✓ В сети (Онлайн)'
            : targetStatus === 'busy'
            ? '⚠ На площадке (Занят)'
            : '○ Офлайн'
        }`,
        statusToastType[targetStatus]
      );

      return {
        ...prev,
        team: updatedTeam,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const pingTeamTelemetry = () => {
    setState((prev) => {
      const onlineCount = prev.team.filter((m) => (m.onlineStatus || 'online') === 'online').length;
      const busyCount = prev.team.filter((m) => m.onlineStatus === 'busy').length;
      const newAct: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'system',
        title: 'Радиоперекличка завершена',
        detail: `Телеметрия команды: ${onlineCount} в сети, ${busyCount} на площадках. Сигнал стабильный.`,
        timestamp: Date.now(),
        actor: 'Система радиомониторинга',
        actorRole: 'Телеметрия',
        badgeType: 'ok'
      };

      addToast(`📡 Радиоперекличка: ${onlineCount + busyCount}/${prev.team.length} сотрудников на связи`, 'ok');

      return {
        ...prev,
        activities: [newAct, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const updateProjectSpent = (projectId: string, newSpent: number) => {
    setState((prev) => {
      const project = prev.projects.find((p) => p.id === projectId);
      if (!project) return prev;

      const allocated = parseBudget(project.budget);
      const clampedSpent = Math.max(0, newSpent);
      
      const { alertsToTrigger, newAlertedThresholds } = checkProjectBudgetAlerts(
        project,
        clampedSpent,
        allocated
      );

      alertsToTrigger.forEach((alert) => {
        addToast(alert.message, alert.type, alert.title);
      });

      const newActivities: ActivityItem[] = alertsToTrigger.map((alert) => ({
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'project',
        title: alert.threshold === 95 ? '🚨 Порог 95% бюджета превышен' : '⚠️ Порог 80% бюджета достигнут',
        detail: alert.message,
        timestamp: Date.now(),
        actor: 'Контроль смет',
        actorRole: 'Штаб',
        badgeType: alert.type === 'bad' ? 'crit' : 'warn',
        target: { type: 'project', id: projectId }
      }));

      const updatedProjects = prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          spentBudget: clampedSpent,
          alertedBudgetThresholds: newAlertedThresholds
        };
      });

      return {
        ...prev,
        projects: updatedProjects,
        activities: [...newActivities, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const addProjectExpense = (projectId: string, expenseData: Omit<ProjectExpense, 'id'>) => {
    setState((prev) => {
      const project = prev.projects.find((p) => p.id === projectId);
      if (!project) return prev;

      const newExpense: ProjectExpense = {
        ...expenseData,
        id: 'exp_' + Date.now() + Math.random().toString(36).slice(2, 5)
      };

      const currentExpenses = project.expenses || [];
      const updatedExpenses = [newExpense, ...currentExpenses];
      const newSpent = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);
      const allocated = parseBudget(project.budget);

      const { alertsToTrigger, newAlertedThresholds } = checkProjectBudgetAlerts(
        project,
        newSpent,
        allocated
      );

      alertsToTrigger.forEach((alert) => {
        addToast(alert.message, alert.type, alert.title);
      });

      const newActivities: ActivityItem[] = alertsToTrigger.map((alert) => ({
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'project',
        title: alert.threshold === 95 ? '🚨 Порог 95% бюджета превышен' : '⚠️ Порог 80% бюджета достигнут',
        detail: alert.message,
        timestamp: Date.now(),
        actor: 'Контроль смет',
        actorRole: 'Штаб',
        badgeType: alert.type === 'bad' ? 'crit' : 'warn',
        target: { type: 'project', id: projectId }
      }));

      const expenseActivity: ActivityItem = {
        id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'project',
        title: `Внесен расход: ${formatRuCurrency(expenseData.amount)}`,
        detail: `${project.id}: «${expenseData.title}» (${expenseData.category})`,
        timestamp: Date.now(),
        actor: 'Диспетчер (вы)',
        actorRole: 'Штаб',
        badgeType: 'info',
        target: { type: 'project', id: projectId }
      };

      const updatedProjects = prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          spentBudget: newSpent,
          expenses: updatedExpenses,
          alertedBudgetThresholds: newAlertedThresholds
        };
      });

      if (alertsToTrigger.length === 0) {
        addToast(
          `Расход добавлен: ${formatRuCurrency(expenseData.amount)} («${expenseData.title}»)`,
          'ok'
        );
      }

      return {
        ...prev,
        projects: updatedProjects,
        activities: [...newActivities, expenseActivity, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const removeProjectExpense = (projectId: string, expenseId: string) => {
    setState((prev) => {
      const project = prev.projects.find((p) => p.id === projectId);
      if (!project) return prev;

      const updatedExpenses = (project.expenses || []).filter((e) => e.id !== expenseId);
      const newSpent = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);
      const allocated = parseBudget(project.budget);
      const percent = allocated > 0 ? Math.round((newSpent / allocated) * 100) : 0;

      let nextAlerted = [...(project.alertedBudgetThresholds || [])];
      if (percent < 80) {
        nextAlerted = nextAlerted.filter((t) => t !== 80 && t !== 95);
      } else if (percent < 95) {
        nextAlerted = nextAlerted.filter((t) => t !== 95);
      }

      const updatedProjects = prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          spentBudget: newSpent,
          expenses: updatedExpenses,
          alertedBudgetThresholds: nextAlerted
        };
      });

      addToast('Расход удален из сметы проекта', 'ok');

      return {
        ...prev,
        projects: updatedProjects
      };
    });
  };

  const triggerBudgetThresholdCheck = (projectId?: string) => {
    setState((prev) => {
      let triggeredCount = 0;
      const newActivities: ActivityItem[] = [];

      const updatedProjects = prev.projects.map((p) => {
        if (projectId && p.id !== projectId) return p;
        if (p.status === 'done') return p;

        const allocated = parseBudget(p.budget);
        const currentSpent = typeof p.spentBudget === 'number'
          ? p.spentBudget
          : (p.expenses && p.expenses.length > 0)
          ? p.expenses.reduce((s, e) => s + e.amount, 0)
          : Math.round(allocated * (getReadiness(p) / 100));

        const { alertsToTrigger, newAlertedThresholds } = checkProjectBudgetAlerts(
          p,
          currentSpent,
          allocated
        );

        if (alertsToTrigger.length > 0) {
          triggeredCount += alertsToTrigger.length;
          alertsToTrigger.forEach((alert) => {
            addToast(alert.message, alert.type, alert.title);
            newActivities.push({
              id: 'act_' + Date.now() + Math.random().toString(36).slice(2, 5),
              type: 'project',
              title: alert.threshold === 95 ? '🚨 Порог 95% бюджета превышен' : '⚠️ Порог 80% бюджета достигнут',
              detail: alert.message,
              timestamp: Date.now(),
              actor: 'Контроль смет',
              actorRole: 'Штаб',
              badgeType: alert.type === 'bad' ? 'crit' : 'warn',
              target: { type: 'project', id: p.id }
            });
          });

          return {
            ...p,
            spentBudget: currentSpent,
            alertedBudgetThresholds: newAlertedThresholds
          };
        }

        return p;
      });

      if (triggeredCount === 0) {
        addToast('Все активные проекты в рамках допустимых лимитов бюджета', 'ok');
      }

      return {
        ...prev,
        projects: updatedProjects,
        activities: [...newActivities, ...(prev.activities || [])].slice(0, 60)
      };
    });
  };

  const resetProjectBudgetAlerts = (projectId: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, alertedBudgetThresholds: [] } : p
      )
    }));
    addToast('Пороговые уведомления сброшены. При превышении сработает повторный алерт', 'acc');
  };

  const resetDemo = () => {
    const seed = getSeedState();
    setState(seed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {
      // ignore
    }
    addToast('Демо-данные восстановлены', 'warn');
  };

  const userById = (id: string) => state.team.find((u) => u.id === id);
  const projById = (id: string) => state.projects.find((p) => p.id === id);
  const eqById = (id: string) => state.equipment.find((q) => q.id === id);

  const projLabel = (id: string) => {
    if (id === 'base') return 'Склад / база';
    const p = projById(id);
    return p ? `${p.id} · ${p.title}` : id;
  };

  const isOverdue = (t: Task) => t.status !== 'done' && daysLeft(t.due) < 0;

  const getReadiness = (p: Project) => {
    const vals = Object.values(p.breakdown);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        curView,
        switchView,
        soonKey,
        setSoonKey,
        selectedProjectId,
        openProject,
        closeProject,
        taskFilter,
        setTaskFilter,
        projFilter,
        setProjFilter,
        eqFilter,
        setEqFilter,
        isModalOpen,
        setIsModalOpen,
        isNewProjectModalOpen,
        setIsNewProjectModalOpen,
        isNewEquipmentModalOpen,
        setIsNewEquipmentModalOpen,
        isNewTeamModalOpen,
        setIsNewTeamModalOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isShortcutsOpen,
        setIsShortcutsOpen,
        isRulesModalOpen,
        setIsRulesModalOpen,
        toggleAutomationRule,
        addAutomationRule,
        deleteAutomationRule,
        runRulesEngine,
        toggleSubtask,
        addSubtask,
        deleteSubtask,
        clearAutomationLogs,
        soundEnabled,
        toggleSound,
        mobileMenuOpen,
        setMobileMenuOpen,
        flashId,
        triggerFlash,
        toasts,
        addToast,
        dismissToast,
        dismissBanner,
        toggleTask,
        cycleTask,
        moveTask,
        addTask,
        deleteTask,
        addProject,
        checkEquipment,
        addEquipment,
        updateEquipmentStatus,
        addTeamMember,
        toggleDocStatus,
        toggleCheckItem,
        toggleDeadline,
        toggleMemberOnlineStatus,
        updateProjectSpent,
        addProjectExpense,
        removeProjectExpense,
        triggerBudgetThresholdCheck,
        resetProjectBudgetAlerts,
        pingTeamTelemetry,
        resetDemo,
        userById,
        projById,
        eqById,
        projLabel,
        isOverdue,
        getReadiness,
        activities: state.activities || [],
        addActivity,
        clearActivities,
        isLiveFeedActive,
        setIsLiveFeedActive,
        simulateFieldEvent
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
