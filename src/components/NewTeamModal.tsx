import React, { useState } from 'react';
import { X, UserPlus, Shield, Radio, MapPin, Percent, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TeamMember } from '../types';

export const NewTeamModal: React.FC = () => {
  const {
    isNewTeamModalOpen,
    setIsNewTeamModalOpen,
    addTeamMember,
    switchView
  } = useApp();

  const [name, setName] = useState('');
  const [role, setRole] = useState('Звукорежиссер FOH');
  const [device, setDevice] = useState<'radio' | 'mobile' | 'desktop'>('radio');
  const [status, setStatus] = useState<TeamMember['status']>('Свободен');
  const [location, setLocation] = useState('База / Склад');
  const [load, setLoad] = useState<number>(30);
  const [primaryComp, setPrimaryComp] = useState('Yamaha / DiGiCo');

  if (!isNewTeamModalOpen) return null;

  const roles = [
    'Звукорежиссер FOH / Мониторы',
    'Художник по свету (GrandMA3)',
    'Инженер видео пультовой / Barco',
    'Главный риггер / Монтажник',
    'Инженер электроснабжения',
    'Технический директор',
    'Стейдж-менеджер площадки',
    'Сервисный инженер склада'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addTeamMember({
      name: name.trim(),
      role,
      device,
      status,
      location: location.trim() || 'База / Склад',
      load: Number(load) || 0,
      onlineStatus: 'online',
      comps: {
        [role.split(' ')[0] || 'Профиль']: primaryComp.trim() || 'Эксперт',
        Рация: device === 'radio' ? 'Канал 1-4' : 'Мобильная связь'
      }
    });

    setName('');
    setIsNewTeamModalOpen(false);
    switchView('team');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[500px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ec4899]/15 text-[#ec4899] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#fafafa]">
                Новый специалист в штаб
              </h3>
              <p className="text-[11px] text-[#71717a]">
                Зачисление в команду, настройка канала радиосвязи и роли
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewTeamModalOpen(false)}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                ФИО специалиста *
              </label>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Артем Лебедев"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#ec4899]"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#ec4899]" />
                <span>Должность / Специализация</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#ec4899] cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-[#18181b]">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Skill & Device Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <Award className="w-3 h-3 text-[#eab308]" />
                  <span>Ключевой навык / Оборудование</span>
                </label>
                <input
                  type="text"
                  value={primaryComp}
                  onChange={(e) => setPrimaryComp(e.target.value)}
                  placeholder="GrandMA3, d&b Audiotechnik..."
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#ec4899]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-[#10b981]" />
                  <span>Устройство связи</span>
                </label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value as 'radio' | 'mobile' | 'desktop')}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#ec4899] cursor-pointer"
                >
                  <option value="radio" className="bg-[#18181b]">Рация штаба (Канал 1-4)</option>
                  <option value="mobile" className="bg-[#18181b]">Мобильный телефон / Мессенджер</option>
                  <option value="desktop" className="bg-[#18181b]">Стационарный диспетчерский пункт</option>
                </select>
              </div>
            </div>

            {/* Location & Initial Load */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#38bdf8]" />
                  <span>Локация базирования</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="База / Склад, ВТБ Арена..."
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#ec4899]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <Percent className="w-3 h-3 text-[#f59e0b]" />
                  <span>Начальная загрузка ({load}%)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={load}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  className="w-full accent-[#ec4899] mt-2 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[#27272a] bg-[#18181b]/50">
            <button
              type="button"
              onClick={() => setIsNewTeamModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#ec4899] hover:bg-[#ec4899]/90 text-white shadow-md shadow-[#ec4899]/20 transition-all cursor-pointer"
            >
              Зачислить в штат
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
