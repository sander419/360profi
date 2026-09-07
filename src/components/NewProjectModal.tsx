import React, { useState } from 'react';
import { X, FolderPlus, Calendar, MapPin, Building, DollarSign, UserCheck, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { D } from '../data/seedData';

export const NewProjectModal: React.FC = () => {
  const {
    state,
    isNewProjectModalOpen,
    setIsNewProjectModalOpen,
    addProject,
    switchView
  } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(D(14));
  const [budget, setBudget] = useState('1 800 000 ₽');
  const [manager, setManager] = useState(state.team[0]?.name || 'Диспетчер');

  if (!isNewProjectModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addProject({
      title: title.trim(),
      description: description.trim(),
      client: client.trim() || 'Корпоративный клиент',
      venue: venue.trim() || 'Основная сцена',
      date: date || D(14),
      budget: budget || '1 500 000 ₽',
      manager: manager || state.team[0]?.name || 'Диспетчер'
    });

    setTitle('');
    setDescription('');
    setClient('');
    setVenue('');
    setIsNewProjectModalOpen(false);
    switchView('projects');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[520px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a] bg-[#18181b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#38bdf8]/15 text-[#38bdf8] flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#fafafa]">
                Новый проект
              </h3>
              <p className="text-[11px] text-[#71717a]">
                Запуск производственного цикла и открытие сметы
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewProjectModalOpen(false)}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                Название проекта / мероприятия *
              </label>
              <input
                type="text"
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: TECH SUMMIT 2026 · Главная сцена"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#a78bfa]" />
                <span>Техническое описание / Сетап</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Оборудование, экран, звук, световой сетап, задачи трансляции..."
                className="w-full px-3.5 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#38bdf8] resize-none"
              />
            </div>

            {/* Client & Venue Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <Building className="w-3 h-3 text-[#38bdf8]" />
                  <span>Клиент / Заказчик</span>
                </label>
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="ПАО Сбер, VK, Яндекс..."
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#38bdf8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#f59e0b]" />
                  <span>Площадка / Локация</span>
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="ВТБ Арена, Зарядье..."
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#38bdf8]"
                />
              </div>
            </div>

            {/* Date & Budget Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#10b981]" />
                  <span>Дата проведения</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-[#eab308]" />
                  <span>Бюджет / Смета</span>
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="2 400 000 ₽"
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#38bdf8]"
                />
              </div>
            </div>

            {/* Manager */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#ec4899]" />
                <span>Ответственный продюсер / Техдир</span>
              </label>
              <select
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
              >
                {state.team.map((m) => (
                  <option key={m.id} value={m.name} className="bg-[#18181b]">
                    {m.name} · {m.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[#27272a] bg-[#18181b]/50">
            <button
              type="button"
              onClick={() => setIsNewProjectModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-[#09090b] shadow-md shadow-[#38bdf8]/20 transition-all cursor-pointer"
            >
              Создать и открыть проект
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
