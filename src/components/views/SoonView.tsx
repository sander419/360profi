import React from 'react';
import {
  BookOpen,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SoonKey } from '../../types';

interface SoonDetail {
  title: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  description: string;
  bulletPoints: string[];
  step: string;
}

const SOON_MAP: Record<SoonKey, SoonDetail> = {
  kb: {
    title: 'База знаний 360PROFI',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'text-[#6366f1]',
    badgeColor: 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/25',
    description:
      'Всё, что сейчас живёт в головах старших сотрудников, — в одном месте: структурированные регламенты, схемы коммутации, видеоинструкции, настройки пультов и процессоров, алгоритмы устранения неполадок на площадке.',
    bulletPoints: [
      'Инструкции по монтажу и безопасной коммутации оборудования',
      'Схемы и фото типовых сетапов (LED, сцены, свет, трансляции)',
      'Справочник частых ошибок и быстрые решения в полевых условиях',
      'Внутренние стандарты качества и чек-листы выездных бригад'
    ],
    step: 'MVP 2'
  },
  academy: {
    title: '360 Academy · обучение и допуски',
    icon: <GraduationCap className="w-6 h-6" />,
    color: 'text-[#8b5cf6]',
    badgeColor: 'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/25',
    description:
      'Программы адаптации новичков, пошаговые треки обучения, практические задания с наставником, система регулярной аттестации и матрица официальных допусков: кого на какие типы проектов можно ставить.',
    bulletPoints: [
      'Пошаговый план онбординга стажёров по дням и сменам',
      'Тестирование знаний и практические зачёты на базе',
      'Аттестация по должностям: Junior → Middle → Senior',
      'Защитная матрица допусков: блокировка назначения недопущенных специалистов'
    ],
    step: 'MVP 3'
  },
  errors: {
    title: 'База ошибок и разборов (Post-event)',
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'text-[#f59e0b]',
    badgeColor: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25',
    description:
      'После каждого мероприятия фиксируем: что пошло не по плану, почему это произошло, как решили в моменте и что нужно изменить в процессах, чтобы исключить повторение. Через полгода — собственная база уникального опыта.',
    bulletPoints: [
      'Стандартизированные отчёты разбора (post-event review)',
      'Цепочка: «Инцидент → Первопричина → Решение → Профилактика»',
      'Автоматическая привязка разборов к чек-листам и карточкам оборудования',
      'Статистика и аналитика по частым причинам сбоев'
    ],
    step: 'MVP 3'
  },
  analytics: {
    title: 'Аналитика и AI-ассистент',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'text-[#10b981]',
    badgeColor: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25',
    description:
      'Накопленные данные о проектах позволяют отслеживать средний чек, маржинальность по типам ивентов, реальную загрузку парка оборудования и людей. Сверху — AI-ассистент, знающий всю базу знаний 360PROFI.',
    bulletPoints: [
      'Коэффициент использования оборудования и простои парка',
      'Рентабельность и трудозатраты по категориям мероприятий',
      'AI-консультант для техников в Telegram: быстрый поиск ответов и схем',
      'Автоматическая генерация итогового отчёта по смете и таймингу'
    ],
    step: 'MVP 4+'
  }
};

export const SoonView: React.FC = () => {
  const { soonKey } = useApp();
  const detail = SOON_MAP[soonKey] || SOON_MAP.kb;

  return (
    <div className="max-w-[780px] space-y-6 animate-in fade-in duration-200">
      {/* Main Roadmap Card */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Icon & Title */}
        <div className="flex items-center gap-4 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${detail.color} bg-[#09090b] border border-[#27272a] shadow-sm`}
          >
            {detail.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${detail.badgeColor}`}
              >
                {detail.step}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#fafafa]">
              {detail.title}
            </h2>
          </div>
        </div>

        {/* Description */}
        <p className="text-[#a1a1aa] text-sm sm:text-[14.5px] leading-relaxed mb-6">
          {detail.description}
        </p>

        {/* Bullet points */}
        <div className="space-y-3 mb-8">
          <div className="text-xs font-medium uppercase tracking-wider text-[#71717a]">
            Что войдёт в этот модуль:
          </div>
          <ul className="space-y-2.5">
            {detail.bulletPoints.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-[#fafafa]/90 leading-snug"
              >
                <CheckCircle2 className="w-4 h-4 text-[#6366f1] mt-0.5 flex-none" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Roadmap Steps */}
        <div className="pt-6 border-t border-[#27272a]">
          <div className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-3">
            Дорожная карта развития:
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
            <span className="px-3 py-1.5 rounded-lg border border-[#10b981]/40 text-[#10b981] bg-[#10b981]/10 flex items-center gap-1.5">
              <span>✓</span>
              <span>MVP 1 · Штаб (сейчас)</span>
            </span>

            <span
              className={`px-3 py-1.5 rounded-lg border ${
                detail.step === 'MVP 2'
                  ? 'border-[#6366f1] text-[#6366f1] bg-[#6366f1]/10'
                  : 'border-[#27272a] text-[#71717a] bg-[#09090b]'
              }`}
            >
              MVP 2 · База знаний + чек-листы
            </span>

            <span
              className={`px-3 py-1.5 rounded-lg border ${
                detail.step === 'MVP 3'
                  ? 'border-[#8b5cf6] text-[#8b5cf6] bg-[#8b5cf6]/10'
                  : 'border-[#27272a] text-[#71717a] bg-[#09090b]'
              }`}
            >
              MVP 3 · Academy, допуски, разборы
            </span>

            <span
              className={`px-3 py-1.5 rounded-lg border ${
                detail.step.startsWith('MVP 4')
                  ? 'border-[#10b981] text-[#10b981] bg-[#10b981]/10'
                  : 'border-[#27272a] text-[#71717a] bg-[#09090b]'
              }`}
            >
              MVP 4 · Аналитика и AI
            </span>
          </div>
        </div>
      </div>

      {/* Philosophy Callout Card */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 text-[#a1a1aa] text-xs sm:text-[13px] leading-relaxed shadow-sm">
        <b className="text-[#fafafa] font-semibold">Принцип работы 360PROFI:</b>{' '}
        берём одну конкретную операционную боль → за несколько дней собираем рабочий вариант → проверяем на реальных сотрудниках и площадках → дорабатываем → берём следующую. Без многомесячных громоздких CRM.
      </div>
    </div>
  );
};
