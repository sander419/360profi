import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsOpen, setIsShortcutsOpen } = useApp();

  if (!isShortcutsOpen) return null;

  const shortcutGroups = [
    {
      title: 'Быстрая навигация',
      items: [
        { keys: ['⌘', 'K'], label: 'Открыть командную строку и глобальный поиск' },
        { keys: ['1'], label: 'Центр управления (Штаб)' },
        { keys: ['2'], label: 'Проекты и производство' },
        { keys: ['3'], label: 'Задачи и Канбан' },
        { keys: ['4'], label: 'Оборудование и склад' },
        { keys: ['5'], label: 'Команда и доступность' },
        { keys: ['?'], label: 'Справка по горячим клавишам' },
        { keys: ['Esc'], label: 'Закрыть любое модальное окно' }
      ]
    },
    {
      title: 'Оперативные действия',
      items: [
        { keys: ['N'], label: 'Создать новую задачу' },
        { keys: ['P'], label: 'Открыть новый проект' }
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[115] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => setIsShortcutsOpen(false)}
    >
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#6366f1]/15 text-[#6366f1] flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#fafafa]">
                Горячие клавиши штаба
              </h3>
              <p className="text-[11px] text-[#71717a]">
                Клавиатурное управление для быстрого реагирования
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsShortcutsOpen(false)}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {shortcutGroups.map((group, gi) => (
            <div key={gi} className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[#71717a]">
                {group.title}
              </div>
              <div className="space-y-1.5">
                {group.items.map((it, ii) => (
                  <div
                    key={ii}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-[#27272a]/50 text-[#fafafa]"
                  >
                    <span className="text-[#a1a1aa]">{it.label}</span>
                    <div className="flex items-center gap-1 flex-none ml-3">
                      {it.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="px-2 py-0.5 rounded bg-[#09090b] border border-[#27272a] font-mono text-[11px] text-[#fafafa] shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#27272a] bg-[#09090b] text-[11px] text-[#71717a] text-center">
          Горячие клавиши активны, когда курсор не находится в текстовом поле
        </div>
      </div>
    </div>
  );
};
