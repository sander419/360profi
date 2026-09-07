import { AppState, ActivityItem, TaskAutomationRule, AutomationLogEntry } from '../types';

export const D = (off: number): string => {
  const dt = new Date();
  dt.setDate(dt.getDate() + off);
  return dt.toISOString().slice(0, 10);
};

export const MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

export const fmtRu = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const fmtRuFull = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const daysLeft = (iso: string): number => {
  if (!iso) return 0;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target.getTime() - t.getTime()) / 86400000);
};

export const initials = (name: string): string => {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const AVC = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#14b8a6', '#ec4899', '#06b6d4'];

export const avColor = (name: string): string => {
  return AVC[(name.charCodeAt(0) + name.length) % AVC.length];
};

export const pctColor = (p: number): string => {
  return p >= 85 ? 'var(--ok)' : p >= 55 ? 'var(--warn)' : 'var(--bad)';
};

export const loadColor = (l: number): string => {
  return l > 85 ? 'var(--bad)' : l >= 50 ? 'var(--acc)' : 'var(--ok)';
};

export const IMG = {
  conf: 'https://image.qwenlm.ai/public_source/fa263eec-a2b5-441d-9e15-5addfff29266/18c19bc05-5759-49fe-8f2b-bb1d7266aa07.png',
  light: 'https://image.qwenlm.ai/public_source/fa263eec-a2b5-441d-9e15-5addfff29266/11b4b2a8a-644b-47f7-8085-f361f1f6ff3e.png',
  broadcast: 'https://image.qwenlm.ai/public_source/fa263eec-a2b5-441d-9e15-5addfff29266/1008ccbf2-9337-4792-93a8-fd6e162f7f0d.png',
  fest: 'https://image.qwenlm.ai/public_source/fa263eec-a2b5-441d-9e15-5addfff29266/18e8e5f45-14e0-4b17-95a5-bbda15036d38.png',
  wh: 'https://image.qwenlm.ai/public_source/fa263eec-a2b5-441d-9e15-5addfff29266/1ef7879f0-5d23-4162-aaae-4c16e45faf7b.png',
  logo: 'https://image.qwenlm.ai/public_source/fa263eec-a2b5-441d-9e15-5addfff29266/1f40ed666-1b11-4e4c-9c64-e86bb2aa444c.png'
};

export const DEFAULT_AUTOMATION_RULES: TaskAutomationRule[] = [
  {
    id: 'rule_auto_done_subtasks',
    name: 'Автозавершение по подзадачам',
    description: 'Автоматически переводить задачу в статус «Выполнено» (Done), когда все подзадачи закрыты',
    trigger: 'all_subtasks_checked',
    action: 'move_to_done',
    enabled: true,
    projectFilter: 'all',
    priorityFilter: 'all',
    triggerCount: 1,
    lastFiredAt: Date.now() - 3600000 * 2,
    isDefault: true
  },
  {
    id: 'rule_notify_pm_overdue',
    name: 'Оповещение РП при просрочке дедлайна',
    description: 'Уведомлять Руководителя проекта (Project Manager) и создавать критический алерт в штаб, если задача просрочена',
    trigger: 'deadline_overdue',
    action: 'notify_pm',
    enabled: true,
    projectFilter: 'all',
    priorityFilter: 'all',
    triggerCount: 0,
    isDefault: true
  },
  {
    id: 'rule_auto_inwork_subtasks',
    name: 'Автоматический старт «В работе»',
    description: 'Переводить задачу из очереди («К выполнению») в «В работе», как только выполнена хотя бы одна подзадача',
    trigger: 'first_subtask_checked',
    action: 'move_to_inwork',
    enabled: true,
    projectFilter: 'all',
    priorityFilter: 'all',
    triggerCount: 0,
    isDefault: true
  },
  {
    id: 'rule_escalate_high_prio',
    name: 'Эскалация High Priority просрочек',
    description: 'Создавать экстренный системный алерт и поднимать тревогу при срыве дедлайна задачи с высоким приоритетом',
    trigger: 'high_prio_overdue',
    action: 'create_alert',
    enabled: true,
    projectFilter: 'all',
    priorityFilter: 'high',
    triggerCount: 0,
    isDefault: true
  }
];

export const DEFAULT_AUTOMATION_LOGS: AutomationLogEntry[] = [
  {
    id: 'log_seed_1',
    ruleId: 'rule_auto_done_subtasks',
    ruleName: 'Автозавершение по подзадачам',
    taskId: 't10',
    taskTitle: 'Post-event проверка комплекта: MedTech День',
    actionTaken: 'Все подзадачи (2/2) закрыты → Статус задачи изменен на «Выполнено»',
    timestamp: Date.now() - 3600000 * 2,
    badge: 'ok'
  }
];

export const getSeedState = (): AppState => ({
  banner: true,
  team: [
    {
      id: 'u1',
      name: 'Сергей Панов',
      role: 'Старший техник',
      load: 92,
      status: 'В проекте',
      comps: { 'LED': 'Senior', 'Свет': 'Middle', 'Камеры': 'Middle', 'Трансляции': 'не допущен', 'Звук': 'Junior' },
      onlineStatus: 'online',
      lastSeen: 'В сети · 2 мин назад',
      device: 'radio',
      location: 'КЗ «Заря» (Зал А)'
    },
    {
      id: 'u2',
      name: 'Илья Морозов',
      role: 'Техник',
      load: 78,
      status: 'В проекте',
      comps: { 'LED': 'Middle', 'Свет': 'Junior', 'Звук': 'Junior', 'Камеры': 'Junior' },
      onlineStatus: 'busy',
      lastSeen: 'На монтаже ферм',
      device: 'mobile',
      location: 'Севкабель Порт'
    },
    {
      id: 'u3',
      name: 'Денис Крот',
      role: 'Инженер трансляций',
      load: 64,
      status: 'В проекте',
      comps: { 'Трансляции': 'Senior', 'Камеры': 'Middle', 'Звук': 'Middle' },
      onlineStatus: 'online',
      lastSeen: 'В сети · мониторинг потока',
      device: 'desktop',
      location: 'ПТС / Диспетчерская'
    },
    {
      id: 'u4',
      name: 'Анна Левина',
      role: 'Менеджер проектов',
      load: 85,
      status: 'В проекте',
      comps: { 'Управление': 'Senior', 'Контент': 'Middle' },
      onlineStatus: 'online',
      lastSeen: 'В сети · на связи',
      device: 'mobile',
      location: 'Штаб 360PROFI'
    },
    {
      id: 'u5',
      name: 'Марат Гизатуллин',
      role: 'Художник по свету',
      load: 46,
      status: 'Свободен',
      comps: { 'Свет': 'Senior', 'Риггинг': 'Middle' },
      onlineStatus: 'online',
      lastSeen: 'В сети · подготовка патча',
      device: 'desktop',
      location: 'База / Склад света'
    },
    {
      id: 'u6',
      name: 'Олег Стрельцов',
      role: 'Техник (обучение)',
      load: 55,
      status: 'Обучение',
      comps: { 'LED': 'Junior', 'Свет': 'Junior', 'Трансляции': 'не допущен' },
      onlineStatus: 'busy',
      lastSeen: 'Практикум Novastar',
      device: 'mobile',
      location: 'Учебный класс'
    },
    {
      id: 'u7',
      name: 'Вера Ким',
      role: 'Контент-менеджер',
      load: 70,
      status: 'В проекте',
      comps: { 'Контент': 'Senior', 'Камеры': 'Junior' },
      onlineStatus: 'online',
      lastSeen: 'В сети · рендеринг заставок',
      device: 'desktop',
      location: 'Удаленно'
    },
    {
      id: 'u8',
      name: 'Павел Раскин',
      role: 'Водитель, риггер',
      load: 38,
      status: 'Свободен',
      comps: { 'Риггинг': 'Middle', 'Логистика': 'Senior' },
      onlineStatus: 'offline',
      lastSeen: 'Офлайн · был 2 ч назад',
      device: 'mobile',
      location: 'В пути / Рейс'
    },
    {
      id: 'u9',
      name: 'Игорь Белов',
      role: 'Менеджер проектов',
      load: 60,
      status: 'В проекте',
      comps: { 'Управление': 'Middle', 'Звук': 'Junior' },
      onlineStatus: 'offline',
      lastSeen: 'Офлайн · был 45 мин назад',
      device: 'mobile',
      location: 'Выходной'
    }
  ],
  projects: [
    {
      id: 'P-241',
      title: 'Форум «Технологии будущего»',
      description: 'Главный технологический форум: монтаж бесшовного светодиодного LED-экрана P2.6 размером 12×3м, многокамерная съемка 4K, резервированная ПТС-трансляция и синхроперевод спикеров.',
      client: 'ТК Сколково',
      venue: 'КЗ «Заря», зал А',
      date: D(3),
      budget: '2 400 000 ₽',
      spentBudget: 1872000,
      expenses: [
        { id: 'exp_241_1', title: 'Аренда модулей LED экрана Unilumin P2.6', amount: 950000, category: 'Оборудование', date: D(-5) },
        { id: 'exp_241_2', title: 'Оплата смен технических специалистов и инженеров', amount: 520000, category: 'Персонал', date: D(-3) },
        { id: 'exp_241_3', title: 'Логистика, доставка оборудования и такелаж', amount: 240000, category: 'Логистика', date: D(-2) },
        { id: 'exp_241_4', title: 'Оптическая коммутация и сплиттеры', amount: 162000, category: 'Расходные материалы', date: D(-1) }
      ],
      alertedBudgetThresholds: [],
      manager: 'u4',
      img: IMG.conf,
      status: 'active',
      breakdown: { team: 100, equipment: 90, logistics: 70, content: 60, documents: 100 },
      teamIds: ['u1', 'u2', 'u3', 'u4', 'u6', 'u7'],
      eqIds: ['e1', 'e4', 'e8', 'e7'],
      deadlines: [
        { t: 'Заезд и монтаж (08:00)', due: D(2), done: false },
        { t: 'Контент финальный от клиента', due: D(2), done: false },
        { t: 'Тест трансляции + резерв', due: D(2), done: false },
        { t: 'Прогон и приёмка площадки', due: D(3), done: false }
      ],
      checks: [
        {
          cat: 'Подготовка',
          items: [
            { t: 'План площадки и схема размещения экрана', done: true },
            { t: 'Расчёт питания (380В, 63А)', done: true },
            { t: 'Расписание смен бригады', done: true },
            { t: 'Брифинг команды перед выездом', done: false }
          ]
        },
        {
          cat: 'Оборудование',
          items: [
            { t: 'Предвыездная проверка LED-кабинетов', done: true },
            { t: 'Резерв: 10 кабинетов + ЗИП', done: true },
            { t: 'Процессор и резервная линия коммутации', done: false },
            { t: 'Комплект кабелей и такелажа', done: true }
          ]
        },
        {
          cat: 'Трансляция',
          items: [
            { t: 'Основной канал (провайдер, 100 Мбит)', done: true },
            { t: 'Резервный канал LTE-bonding', done: false },
            { t: 'Звуковая дорожка для стрима', done: false }
          ]
        },
        {
          cat: 'Демонтаж и возврат',
          items: [
            { t: 'График демонтажа согласован с площадкой', done: true },
            { t: 'Чек-лист возврата на склад', done: false }
          ]
        }
      ]
    },
    {
      id: 'P-242',
      title: 'Юбилей компании «Альфа Энерго»',
      description: 'Юбилейное шоу: световой дизайн на 12 динамических головах moving head, управление пультом grandMA2, тяжелый сценический дым и синхронизированный видеоконтент.',
      client: 'Альфа Энерго',
      venue: 'Лофт «Фабрика»',
      date: D(6),
      budget: '1 150 000 ₽',
      spentBudget: 943000,
      expenses: [
        { id: 'exp_242_1', title: 'Аренда световых приборов Moving Heads (12 шт)', amount: 540000, category: 'Оборудование', date: D(-4) },
        { id: 'exp_242_2', title: 'Пульт управления светом grandMA2 + патч', amount: 220000, category: 'Оборудование', date: D(-2) },
        { id: 'exp_242_3', title: 'Спецэффекты, тяжелый дым и генераторы искр', amount: 183000, category: 'Спецэффекты', date: D(-1) }
      ],
      alertedBudgetThresholds: [80],
      manager: 'u4',
      img: IMG.light,
      status: 'active',
      breakdown: { team: 80, equipment: 60, logistics: 50, content: 40, documents: 90 },
      teamIds: ['u3', 'u4', 'u5', 'u7', 'u8'],
      eqIds: ['e6', 'e9', 'e5'],
      deadlines: [
        { t: 'Световой дизайн-проект', due: D(3), done: false },
        { t: 'Договор подписан', due: D(2), done: false },
        { t: 'Заезд и монтаж', due: D(5), done: false }
      ],
      checks: [
        {
          cat: 'Подготовка',
          items: [
            { t: 'Смета согласована', done: true },
            { t: 'Световой дизайн-концепт', done: false },
            { t: 'Тайминг мероприятия от клиента', done: true }
          ]
        },
        {
          cat: 'Оборудование',
          items: [
            { t: 'Диагностика grandMA2', done: false },
            { t: 'Проверка moving head (12 шт)', done: true },
            { t: 'Коммутация DMX', done: false }
          ]
        },
        {
          cat: 'Контент',
          items: [
            { t: 'Видеоролик-открытие (черновик)', done: true },
            { t: 'Финальный монтаж ролика', done: false },
            { t: 'Плейлисты и подложки', done: false }
          ]
        }
      ]
    },
    {
      id: 'P-243',
      title: 'Фестиваль «Город Звука» (open-air)',
      description: 'Масштабный фестиваль под открытым небом: граунд-саппорт фермы Prolyte, уличная крышная сцена, линейный массив L-Acoustics K2 и дизель-генераторы 100 кВт.',
      client: 'Администрация города',
      venue: 'Парк Горького, главная сцена',
      date: D(12),
      budget: '4 800 000 ₽',
      spentBudget: 2160000,
      expenses: [
        { id: 'exp_243_1', title: 'Конструкция уличной крышной сцены и граунд-саппорт', amount: 1400000, category: 'Конструкции', date: D(-6) },
        { id: 'exp_243_2', title: 'Звуковая система L-Acoustics K2 + сабвуферы', amount: 760000, category: 'Оборудование', date: D(-3) }
      ],
      alertedBudgetThresholds: [],
      manager: 'u9',
      img: IMG.fest,
      status: 'active',
      breakdown: { team: 60, equipment: 70, logistics: 30, content: 20, documents: 40 },
      teamIds: ['u1', 'u7', 'u9'],
      eqIds: ['e2', 'e6', 'e10', 'e3'],
      deadlines: [
        { t: 'Разрешение на open-air', due: D(-2), done: false },
        { t: 'Схема электроснабжения сцены', due: D(4), done: false },
        { t: 'Логистика: 3 фуры + генераторы', due: D(7), done: false }
      ],
      checks: [
        {
          cat: 'Документы',
          items: [
            { t: 'Разрешение на массовое мероприятие', done: false },
            { t: 'Согласование шумовых норм', done: true },
            { t: 'Страховка конструкции сцены', done: false }
          ]
        },
        {
          cat: 'Оборудование',
          items: [
            { t: 'Ремонт кабинета #104', done: false },
            { t: 'Бронь line array у партнёра', done: true },
            { t: 'Резервные генераторы', done: false }
          ]
        },
        {
          cat: 'Логистика',
          items: [
            { t: 'Маршрут и график загрузок', done: false },
            { t: 'Пропуска на въезд в парк', done: false }
          ]
        }
      ]
    },
    {
      id: 'P-244',
      title: 'Презентация X-Drive',
      description: 'Презентация премиального автомобиля в шоуруме: акцентный автомобильный свет, подиум с подсветкой, беспроводные микрофоны Shure и прямая онлайн-трансляция.',
      client: 'X-Drive Motors',
      venue: 'Шоурум на Тверской',
      date: D(18),
      budget: '900 000 ₽',
      spentBudget: 864000,
      expenses: [
        { id: 'exp_244_1', title: 'ПТС трансляция и многокамерная съемка 4K', amount: 490000, category: 'Видео/Стрим', date: D(-3) },
        { id: 'exp_244_2', title: 'Световое оформление подиума и подсветка авто', amount: 240000, category: 'Свет', date: D(-2) },
        { id: 'exp_244_3', title: 'Звуковое сопровождение и беспроводные микрофоны', amount: 134000, category: 'Звук', date: D(-1) }
      ],
      alertedBudgetThresholds: [80, 95],
      manager: 'u9',
      img: IMG.broadcast,
      status: 'active',
      breakdown: { team: 40, equipment: 50, logistics: 40, content: 30, documents: 20 },
      teamIds: ['u9'],
      eqIds: ['e7'],
      deadlines: [
        { t: 'Технический райдер с площадкой', due: D(4), done: false },
        { t: 'КП этапа 2 отправлено', due: D(1), done: false }
      ],
      checks: [
        {
          cat: 'Подготовка',
          items: [
            { t: 'Обмер площадки', done: true },
            { t: 'Райдер и схема зала', done: false }
          ]
        },
        {
          cat: 'Контент',
          items: [
            { t: 'Презентационные ролики от клиента', done: false }
          ]
        }
      ]
    },
    {
      id: 'P-239',
      title: 'Конференция «MedTech День»',
      description: 'Медицинская конференция с круглыми столами: озвучивание трех залов, видеостена, телемост с зарубежными клиниками и суфлеры для спикеров.',
      client: 'MedTech Альянс',
      venue: 'Отель «Космос»',
      date: D(-5),
      budget: '1 700 000 ₽',
      spentBudget: 1700000,
      expenses: [
        { id: 'exp_239_1', title: 'Полный комплекс технического обеспечения под ключ', amount: 1700000, category: 'Комплекс', date: D(-7) }
      ],
      alertedBudgetThresholds: [80, 95],
      manager: 'u4',
      img: IMG.conf,
      status: 'done',
      breakdown: { team: 100, equipment: 100, logistics: 100, content: 100, documents: 100 },
      teamIds: ['u2', 'u4'],
      eqIds: [],
      deadlines: [],
      checks: []
    }
  ],
  tasks: [
    {
      id: 't2',
      title: 'Забронировать транспорт (Газель + грузчики) на монтаж',
      project: 'P-241',
      assignee: 'u8',
      due: D(-1),
      start: D(-3),
      durationDays: 2,
      prio: 'high',
      status: 'todo',
      subtasks: [
        { id: 'st-t2-1', title: 'Заказ удлиненной Газели 4.2м с гидробортом', done: true },
        { id: 'st-t2-2', title: 'Согласовать ночной пропуск во двор Экспоцентра', done: false }
      ]
    },
    {
      id: 't1',
      title: 'Собрать LED-экран 12×3 м, предвыездная проверка кабинетов',
      project: 'P-241',
      assignee: 'u1',
      due: D(1),
      start: D(-1),
      durationDays: 2,
      prio: 'high',
      status: 'inwork',
      blockedBy: ['t2'],
      subtasks: [
        { id: 'st-t1-1', title: 'Проверить приемные карты Novastar и блоки питания', done: true },
        { id: 'st-t1-2', title: 'Смонтировать подвес на ферму Prolyte H30V', done: true },
        { id: 'st-t1-3', title: 'Подключить силовые кабели Powercon True1', done: false }
      ]
    },
    {
      id: 't3',
      title: 'Получить финальный видеоконтент программы от клиента',
      project: 'P-241',
      assignee: 'u7',
      due: D(2),
      start: D(0),
      durationDays: 2,
      prio: 'med',
      status: 'inwork',
      subtasks: [
        { id: 'st-t3-1', title: 'Запросить исходники 4K/ProRes у продакшна', done: true },
        { id: 'st-t3-2', title: 'Сверить таймкоды и звуковые дорожки', done: false }
      ]
    },
    {
      id: 't4',
      title: 'Протестировать резервный канал трансляции (LTE-bonding)',
      project: 'P-241',
      assignee: 'u3',
      due: D(4),
      start: D(2),
      durationDays: 2,
      prio: 'high',
      status: 'todo',
      blockedBy: ['t1', 't3'],
      subtasks: [
        { id: 'st-t4-1', title: 'Установить SIM-карты Мегафон и МТС в роутер', done: false },
        { id: 'st-t4-2', title: 'Замерить uplink-скорость в зале (>35 Мбит/с)', done: false },
        { id: 'st-t4-3', title: 'Провести 15-минутный тестовый RTMP стрим', done: false }
      ]
    },
    {
      id: 't6',
      title: 'Диагностика пульта grandMA2 перед выездом',
      project: 'P-242',
      assignee: 'u5',
      due: D(3),
      start: D(1),
      durationDays: 2,
      prio: 'med',
      status: 'inwork',
      subtasks: [
        { id: 'st-t6-1', title: 'Проверка моторизованных фейдеров и энкодеров', done: true },
        { id: 'st-t6-2', title: 'Обновление fixture library под приборы площадки', done: false }
      ]
    },
    {
      id: 't5',
      title: 'Печать бейджей и навигации по площадке',
      project: 'P-242',
      assignee: 'u7',
      due: D(5),
      start: D(3),
      durationDays: 2,
      prio: 'low',
      status: 'todo',
      blockedBy: ['t6']
    },
    {
      id: 't7',
      title: 'Подписать договор с администрацией (open-air)',
      project: 'P-243',
      assignee: 'u9',
      due: D(-2),
      start: D(-5),
      durationDays: 3,
      prio: 'high',
      status: 'todo',
      subtasks: [
        { id: 'st-t7-1', title: 'Сформировать пакет документов и схему расстановки', done: true },
        { id: 'st-t7-2', title: 'Получить подпись в комитете по культуре', done: false }
      ]
    },
    {
      id: 't8',
      title: 'Заказать line array у партнёрского проката',
      project: 'P-243',
      assignee: 'u1',
      due: D(6),
      start: D(1),
      durationDays: 5,
      prio: 'med',
      status: 'todo',
      blockedBy: ['t7'],
      subtasks: [
        { id: 'st-t8-1', title: 'Расчет акустического давления в Soundvision', done: false },
        { id: 'st-t8-2', title: 'Согласовать аренду усилителей LA8', done: false }
      ]
    },
    {
      id: 't9',
      title: 'Обновить в базе знаний схему монтажа кабинета #104',
      project: 'base',
      assignee: 'u6',
      due: D(7),
      start: D(4),
      durationDays: 3,
      prio: 'low',
      status: 'todo'
    },
    {
      id: 't10',
      title: 'Post-event проверка комплекта: MedTech День',
      project: 'P-239',
      assignee: 'u2',
      due: D(-3),
      start: D(-5),
      durationDays: 2,
      prio: 'med',
      status: 'done',
      subtasks: [
        { id: 'st-t10-1', title: 'Сверка номеров кабинетов и кофров по описи', done: true },
        { id: 'st-t10-2', title: 'Подписание акта возврата клиентом', done: true }
      ]
    },
    {
      id: 't11',
      title: 'Подготовить КП этапа 2 для X-Drive',
      project: 'P-244',
      assignee: 'u4',
      due: D(2),
      start: D(0),
      durationDays: 2,
      prio: 'med',
      status: 'inwork',
      subtasks: [
        { id: 'st-t11-1', title: 'Сверить партнерские скидки на звук', done: true },
        { id: 'st-t11-2', title: 'Отправить PDF-смету заказчику', done: false }
      ]
    },
    {
      id: 't12',
      title: 'Инвентаризация кабельных линий, заменить 3 неисправных XLR',
      project: 'base',
      assignee: 'u2',
      due: D(1),
      start: D(-1),
      durationDays: 2,
      prio: 'med',
      status: 'todo'
    }
  ],
  equipment: [
    {
      id: 'e1',
      name: 'LED-кабинеты P3.9 (компл. 40 шт, #101–#140)',
      cat: 'LED',
      status: 'project',
      project: 'P-241',
      lastCheck: D(-2),
      resp: 'u1',
      issues: 1,
      note: ''
    },
    {
      id: 'e2',
      name: 'LED-кабинеты P4.8 outdoor (компл. 60 шт)',
      cat: 'LED',
      status: 'stock',
      project: null,
      lastCheck: D(-9),
      resp: 'u2',
      issues: 0,
      note: ''
    },
    {
      id: 'e3',
      name: 'LED-кабинет #104',
      cat: 'LED',
      status: 'repair',
      project: null,
      lastCheck: D(-21),
      resp: 'u1',
      issues: 3,
      note: 'блок питания, ждём запчасть'
    },
    {
      id: 'e4',
      name: 'Процессор Novastar H2',
      cat: 'LED',
      status: 'project',
      project: 'P-241',
      lastCheck: D(-2),
      resp: 'u1',
      issues: 0,
      note: ''
    },
    {
      id: 'e5',
      name: 'Пульт grandMA2 light',
      cat: 'Свет',
      status: 'stock',
      project: null,
      lastCheck: D(-40),
      resp: 'u5',
      issues: 1,
      note: 'просрочена плановая проверка'
    },
    {
      id: 'e6',
      name: 'Moving head Beam 230 (12 шт)',
      cat: 'Свет',
      status: 'project',
      project: 'P-242',
      lastCheck: D(-4),
      resp: 'u5',
      issues: 0,
      note: ''
    },
    {
      id: 'e7',
      name: 'Камеры Sony PXW-Z280 (#1, #2)',
      cat: 'Камеры',
      status: 'stock',
      project: null,
      lastCheck: D(-6),
      resp: 'u3',
      issues: 0,
      note: ''
    },
    {
      id: 'e8',
      name: 'Передатчик LiveU LU800 (трансляции)',
      cat: 'Трансляции',
      status: 'project',
      project: 'P-241',
      lastCheck: D(-3),
      resp: 'u3',
      issues: 2,
      note: ''
    },
    {
      id: 'e9',
      name: 'Микшер ATEM Constellation 8K',
      cat: 'Трансляции',
      status: 'reserved',
      project: 'P-242',
      lastCheck: D(-12),
      resp: 'u3',
      issues: 0,
      note: ''
    },
    {
      id: 'e10',
      name: 'Line array L-Acoustics Kiva (аренда партнёра)',
      cat: 'Звук',
      status: 'reserved',
      project: 'P-243',
      lastCheck: D(-30),
      resp: 'u9',
      issues: 0,
      note: ''
    },
    {
      id: 'e11',
      name: 'Генератор 30 кВт',
      cat: 'Питание',
      status: 'stock',
      project: null,
      lastCheck: D(-45),
      resp: 'u8',
      issues: 1,
      note: 'требуется ТО'
    },
    {
      id: 'e12',
      name: 'Фермы 3 м (24 секции)',
      cat: 'Риггинг',
      status: 'stock',
      project: null,
      lastCheck: D(-15),
      resp: 'u8',
      issues: 0,
      note: ''
    }
  ],
  docs: [
    { id: 'd1', name: 'КП + смета (подписано)', project: 'P-241', status: 'ok', due: null },
    { id: 'd2', name: 'Схема электроснабжения зала А', project: 'P-241', status: 'ok', due: null },
    { id: 'd3', name: 'Договор на мероприятие', project: 'P-242', status: 'approval', due: D(2) },
    { id: 'd4', name: 'Разрешение на open-air', project: 'P-243', status: 'missing', due: D(-2) },
    { id: 'd5', name: 'Брифинг по технике безопасности', project: 'P-243', status: 'approval', due: D(1) },
    { id: 'd6', name: 'Страховое свидетельство оборудования', project: null, status: 'ok', due: D(20) },
    { id: 'd7', name: 'Техрайдер, согласованный с площадкой', project: 'P-244', status: 'missing', due: D(4) }
  ],
  alerts: [
    {
      sev: 'crit',
      text: 'P-243 «Город Звука»: нет разрешения на open-air',
      sub: 'дедлайн просрочен на 2 дня · отв. И. Белов',
      go: { type: 'project', id: 'P-243' }
    },
    {
      sev: 'crit',
      text: 'P-241: транспорт на монтаж не забронирован',
      sub: 'заезд через 2 дня · задача t2 просрочена',
      go: { type: 'project', id: 'P-241' }
    },
    {
      sev: 'warn',
      text: 'Пульт grandMA2: просрочена плановая проверка',
      sub: '40 дней с последней проверки · отв. М. Гизатуллин',
      go: { type: 'equipment', id: 'e5' }
    },
    {
      sev: 'warn',
      text: 'LED-кабинет #104 в ремонте, но заявлен на P-243',
      sub: 'блок питания, запчасть в пути',
      go: { type: 'equipment', id: 'e3' }
    },
    {
      sev: 'info',
      text: 'О. Стрельцов: аттестация по трансляциям не пройдена',
      sub: 'нельзя назначать на задачи трансляции (допуск)',
      go: { type: 'team', id: 'u6' }
    }
  ],
  training: [
    {
      name: 'Олег Стрельцов',
      stage: 'День 3 из 5 · Коммутация и кабельные линии',
      mentor: 'Сергей Панов',
      progress: 60
    },
    {
      name: 'Марина Власова',
      stage: 'Стажировка, неделя 1 · Оборудование и безопасность',
      mentor: 'Илья Морозов',
      progress: 20
    }
  ],
  activities: getSeedActivities(),
  automationRules: DEFAULT_AUTOMATION_RULES,
  automationLogs: DEFAULT_AUTOMATION_LOGS
});

export const formatRelativeTime = (timestamp: number): string => {
  const diff = Math.max(0, Date.now() - timestamp);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  return `${days} дн назад`;
};

export const getSeedActivities = (): ActivityItem[] => {
  const now = Date.now();
  return [
    {
      id: 'act_1',
      type: 'task',
      title: 'Задача выполнена',
      detail: '«Проверить силовой кабель 380V / 63A для P-241»',
      timestamp: now - 3 * 60 * 1000,
      actor: 'Сергей Панов',
      actorRole: 'Бригадир / Свет',
      badgeType: 'ok',
      target: { type: 'project', id: 'P-241' }
    },
    {
      id: 'act_2',
      type: 'equipment',
      title: 'ТО оборудования подтверждено',
      detail: 'Пульт Chamsys MQ500M — очистка оптики, тест фейдеров и DMX',
      timestamp: now - 14 * 60 * 1000,
      actor: 'Алексей Морозов',
      actorRole: 'Техник света',
      badgeType: 'ok',
      target: { type: 'equipment', id: 'e6' }
    },
    {
      id: 'act_3',
      type: 'system',
      title: 'Контроль дедлайнов штаба',
      detail: 'Предупреждение: согласование технического райдера P-241 истекает завтра',
      timestamp: now - 32 * 60 * 1000,
      actor: 'Система 360PROFI',
      badgeType: 'warn',
      target: { type: 'project', id: 'P-241' }
    },
    {
      id: 'act_4',
      type: 'doc',
      title: 'Документ передан на утверждение',
      detail: 'Смета и договор №242/К для ВК Фест 2026',
      timestamp: now - 58 * 60 * 1000,
      actor: 'Елена Васильева',
      actorRole: 'Продюсер',
      badgeType: 'info',
      target: { type: 'project', id: 'P-242' }
    },
    {
      id: 'act_5',
      type: 'project',
      title: 'Пункт чек-листа закрыт',
      detail: 'P-243: Сборка сценического подиума 8х6м принята инженером',
      timestamp: now - 95 * 60 * 1000,
      actor: 'Илья Морозов',
      actorRole: 'Инженер',
      badgeType: 'ok',
      target: { type: 'project', id: 'P-243' }
    },
    {
      id: 'act_6',
      type: 'system',
      title: 'Телеметрия склада',
      detail: 'Возврат оборудования после фестиваля: 14 кейсов коммутации приняты на склад',
      timestamp: now - 150 * 60 * 1000,
      actor: 'Склад 360PROFI',
      badgeType: 'info'
    },
    {
      id: 'act_7',
      type: 'equipment',
      title: 'Дефект направлен в сервис',
      detail: 'LED-кабинет #104: замена блока питания, деталь заказана у поставщика',
      timestamp: now - 210 * 60 * 1000,
      actor: 'Михаил Гизатуллин',
      actorRole: 'Инженер видео',
      badgeType: 'crit',
      target: { type: 'equipment', id: 'e3' }
    }
  ];
};

export const SIMULATED_FIELD_EVENTS: Omit<ActivityItem, 'id' | 'timestamp'>[] = [
  {
    type: 'project',
    title: 'Монтаж согласован инженером площадки',
    detail: 'P-241: Инженер площадки подтвердил подключение силового ввода 380V / 125A',
    actor: 'Сергей Панов',
    actorRole: 'Бригадир / Свет',
    badgeType: 'ok',
    target: { type: 'project', id: 'P-241' }
  },
  {
    type: 'equipment',
    title: 'Телеметрия процессора Novastar',
    detail: 'Видеостена LED: синхронизация 60.00 Hz, температура контроллера 36°C (норма)',
    actor: 'Система 360PROFI',
    badgeType: 'info',
    target: { type: 'equipment', id: 'e1' }
  },
  {
    type: 'task',
    title: 'Скан радиочастот Shure Axient',
    detail: 'Скан эфира в диапазоне 470–636 МГц завершен: помехи отсутствуют, 8 каналов активны',
    actor: 'Алексей Морозов',
    actorRole: 'Звукорежиссер',
    badgeType: 'ok',
    target: { type: 'project', id: 'P-241' }
  },
  {
    type: 'equipment',
    title: 'Склад: отгрузка комплекта',
    detail: 'Кофры коммутации DMX и оптики погружены в транспорт для проекта P-242',
    actor: 'Склад 360PROFI',
    badgeType: 'info'
  },
  {
    type: 'system',
    title: 'Мониторинг сети Dante',
    detail: 'Основной и резервный потоки Redundant Dante активны, потерь пакетов нет',
    actor: 'Система 360PROFI',
    badgeType: 'ok'
  },
  {
    type: 'system',
    title: 'Датчик температуры диммерной',
    detail: 'Стойка диммеров 12х5кВт: вентиляция переведена на повышенную мощность',
    actor: 'Телеметрия площадки',
    badgeType: 'warn'
  },
  {
    type: 'project',
    title: 'Площадка: заезд транспорта',
    detail: 'P-243: Фура прибыла на разгрузку к пандусу Севкабель Порт, начат монтаж',
    actor: 'Илья Морозов',
    actorRole: 'Инженер',
    badgeType: 'info',
    target: { type: 'project', id: 'P-243' }
  }
];
