import { Project, Task, TeamMember, EquipmentItem } from '../types';
import { fmtRu, daysLeft } from '../data/seedData';

/**
 * Escapes a field for CSV format and wraps with quotes if needed
 */
function escapeCsvValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // Always wrap in quotes and escape internal quotes by doubling them
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Triggers browser download of a CSV file with UTF-8 BOM for Excel Cyrillic compatibility
 */
export function downloadCsv(filename: string, rows: string[][]): void {
  // \uFEFF is the UTF-8 Byte Order Mark (BOM) ensuring Excel displays Cyrillic correctly
  const csvContent = '\uFEFF' + rows.map((row) => row.map(escapeCsvValue).join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports project list to CSV
 */
export function exportProjectsToCsv(
  projects: Project[],
  getReadiness: (project: Project) => number,
  userById: (id: string) => TeamMember | undefined
): void {
  const headers = [
    'ID проекта',
    'Название проекта',
    'Клиент',
    'Площадка / Локация',
    'Дата мероприятия',
    'Дней до мероприятия',
    'Статус',
    'Готовность общая (%)',
    'Команда (%)',
    'Оборудование (%)',
    'Логистика (%)',
    'Контент (%)',
    'Документы (%)',
    'Бюджет',
    'Команда',
    'Всего вех',
    'Выполнено вех',
    'Просрочено вех'
  ];

  const rows: string[][] = [headers];

  projects.forEach((p) => {
    const readiness = getReadiness(p);
    const evDays = daysLeft(p.date);
    const statusText = p.status === 'active' ? 'В работе' : 'Завершён';

    // Team names
    const teamNames = (p.teamIds || [])
      .map((uid) => userById(uid)?.name)
      .filter(Boolean)
      .join(', ');

    // Deadlines
    let totalDl = 0;
    let doneDl = 0;
    let overdueDl = 0;
    (p.deadlines || []).forEach((dl) => {
      totalDl++;
      if (dl.done) {
        doneDl++;
      } else if (daysLeft(dl.due) < 0) {
        overdueDl++;
      }
    });

    rows.push([
      p.id,
      p.title,
      p.client,
      p.venue,
      fmtRu(p.date),
      evDays >= 0 ? `${evDays}` : `-${Math.abs(evDays)}`,
      statusText,
      `${readiness}%`,
      `${p.breakdown.team}%`,
      `${p.breakdown.equipment}%`,
      `${p.breakdown.logistics}%`,
      `${p.breakdown.content}%`,
      `${p.breakdown.documents}%`,
      p.budget,
      teamNames,
      `${totalDl}`,
      `${doneDl}`,
      `${overdueDl}`
    ]);
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`projects_report_${nowStr}.csv`, rows);
}

/**
 * Exports task list to CSV
 */
export function exportTasksToCsv(
  tasks: Task[],
  projLabel: (projectId: string) => string,
  userById: (id: string) => TeamMember | undefined
): void {
  const headers = [
    'ID задачи',
    'Название задачи',
    'Проект',
    'Ответственный',
    'Статус',
    'Приоритет',
    'Срок выполнения',
    'Дней до срока',
    'Просрочена'
  ];

  const statusMap: Record<Task['status'], string> = {
    todo: 'К выполнению',
    inwork: 'В работе',
    done: 'Выполнено'
  };

  const priorityMap: Record<Task['prio'], string> = {
    high: 'Высокий',
    med: 'Средний',
    low: 'Низкий'
  };

  const rows: string[][] = [headers];

  tasks.forEach((t) => {
    const assignee = userById(t.assignee)?.name || t.assignee;
    const project = projLabel(t.project);
    const dLeft = daysLeft(t.due);
    const isOverdue = t.status !== 'done' && dLeft < 0;

    rows.push([
      t.id,
      t.title,
      project,
      assignee,
      statusMap[t.status] || t.status,
      priorityMap[t.prio] || t.prio,
      fmtRu(t.due),
      dLeft === 0 ? 'Сегодня' : dLeft > 0 ? `+${dLeft}` : `${dLeft}`,
      isOverdue ? 'Да (Просрочена)' : 'Нет'
    ]);
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`tasks_report_${nowStr}.csv`, rows);
}

/**
 * Exports equipment inventory to CSV
 */
export function exportEquipmentToCsv(
  equipment: EquipmentItem[],
  userById: (id: string) => TeamMember | undefined
): void {
  const headers = [
    'ID единицы',
    'Наименование',
    'Категория',
    'Статус',
    'Проект / Локация',
    'Последняя проверка',
    'Дней с проверки',
    'Ответственный',
    'Количество неисправностей',
    'Примечание'
  ];

  const statusMap: Record<string, string> = {
    stock: 'На складе',
    project: 'На проекте',
    repair: 'В ремонте',
    reserved: 'В резерве',
    transit: 'В пути'
  };

  const rows: string[][] = [headers];

  equipment.forEach((eq) => {
    const resp = userById(eq.resp)?.name || eq.resp;
    const daysSince = Math.abs(daysLeft(eq.lastCheck));
    rows.push([
      eq.id,
      eq.name,
      eq.cat,
      statusMap[eq.status] || eq.status,
      eq.project || 'Склад / База',
      fmtRu(eq.lastCheck),
      `${daysSince} дн назад`,
      resp,
      `${eq.issues}`,
      eq.note || ''
    ]);
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`equipment_inventory_${nowStr}.csv`, rows);
}

/**
 * Exports team crew deployment and contact roster to CSV
 */
export function exportTeamToCsv(team: TeamMember[]): void {
  const headers = [
    'ID',
    'ФИО сотрудника',
    'Должность',
    'Статус связи',
    'Загрузка (%)',
    'Статус в компании',
    'Локация / Объект',
    'Канал радиосвязи',
    'Компетенции'
  ];

  const statusMap: Record<string, string> = {
    online: 'В сети (Онлайн)',
    busy: 'На площадке (Занят)',
    offline: 'Офлайн'
  };

  const rows: string[][] = [headers];

  team.forEach((u) => {
    const compsStr = Object.entries(u.comps || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    rows.push([
      u.id,
      u.name,
      u.role,
      statusMap[u.onlineStatus || 'online'] || 'В сети',
      `${u.load}%`,
      u.status,
      u.location || 'База / Офис',
      u.device === 'radio' ? 'Канал 1-4' : 'Мобильный',
      compsStr
    ]);
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`team_roster_${nowStr}.csv`, rows);
}

