export type MemberOnlineStatus = 'online' | 'busy' | 'offline';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  load: number;
  status: 'В проекте' | 'Свободен' | 'Обучение';
  comps: Record<string, string>;
  onlineStatus?: MemberOnlineStatus;
  lastSeen?: string;
  device?: 'radio' | 'mobile' | 'desktop';
  location?: string;
}

export interface ProjectDeadline {
  t: string;
  due: string;
  done: boolean;
}

export interface CheckItem {
  t: string;
  done: boolean;
}

export interface CheckCategory {
  cat: string;
  items: CheckItem[];
}

export interface ProjectBreakdown {
  team: number;
  equipment: number;
  logistics: number;
  content: number;
  documents: number;
}

export interface ProjectExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  client: string;
  venue: string;
  date: string;
  budget: string;
  spentBudget?: number;
  expenses?: ProjectExpense[];
  alertedBudgetThresholds?: number[];
  manager: string;
  img: string;
  status: 'active' | 'done';
  breakdown: ProjectBreakdown;
  teamIds: string[];
  eqIds: string[];
  deadlines: ProjectDeadline[];
  checks: CheckCategory[];
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  assignee: string;
  due: string;
  prio: 'high' | 'med' | 'low';
  status: 'todo' | 'inwork' | 'done';
  blockedBy?: string[];
  start?: string;
  durationDays?: number;
  subtasks?: Subtask[];
  notifiedPmOverdue?: boolean;
}

export type EquipmentStatus = 'stock' | 'project' | 'repair' | 'reserved' | 'transit';

export interface EquipmentItem {
  id: string;
  name: string;
  cat: string;
  status: EquipmentStatus;
  project: string | null;
  lastCheck: string;
  resp: string;
  issues: number;
  note: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  project: string | null;
  status: 'ok' | 'approval' | 'missing';
  due: string | null;
}

export interface AlertItem {
  sev: 'crit' | 'warn' | 'info';
  text: string;
  sub: string;
  go: {
    type: 'project' | 'equipment' | 'team';
    id: string;
  };
}

export interface TrainingItem {
  name: string;
  stage: string;
  mentor: string;
  progress: number;
}

export type ActivityType = 'task' | 'equipment' | 'project' | 'doc' | 'system' | 'team';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  timestamp: number;
  actor: string;
  actorRole?: string;
  badgeType: 'ok' | 'warn' | 'crit' | 'info';
  target?: {
    type: 'project' | 'equipment' | 'team' | 'task';
    id: string;
  };
}

export type AutomationTrigger =
  | 'all_subtasks_checked'
  | 'deadline_overdue'
  | 'first_subtask_checked'
  | 'high_prio_overdue';

export type AutomationAction =
  | 'move_to_done'
  | 'move_to_inwork'
  | 'notify_pm'
  | 'create_alert';

export interface TaskAutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
  projectFilter?: string; // 'all' or specific project id
  priorityFilter?: 'all' | 'high' | 'med' | 'low';
  triggerCount: number;
  lastFiredAt?: number;
  isDefault?: boolean;
}

export interface AutomationLogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  taskId: string;
  taskTitle: string;
  actionTaken: string;
  timestamp: number;
  badge: 'ok' | 'warn' | 'crit' | 'info';
  targetManager?: string;
}

export interface AppState {
  banner: boolean;
  team: TeamMember[];
  projects: Project[];
  tasks: Task[];
  equipment: EquipmentItem[];
  docs: DocumentItem[];
  alerts: AlertItem[];
  training: TrainingItem[];
  activities: ActivityItem[];
  automationRules?: TaskAutomationRule[];
  automationLogs?: AutomationLogEntry[];
}

export type ViewType = 'hub' | 'projects' | 'tasks' | 'equipment' | 'team' | 'soon';
export type SoonKey = 'kb' | 'academy' | 'errors' | 'analytics';

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  type?: 'ok' | 'warn' | 'bad' | 'acc';
}
