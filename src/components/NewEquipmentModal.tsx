import React, { useState } from 'react';
import { X, PackagePlus, Tag, ShieldCheck, UserCheck, FileText, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EquipmentStatus } from '../types';
import { D } from '../data/seedData';

export const NewEquipmentModal: React.FC = () => {
  const {
    state,
    isNewEquipmentModalOpen,
    setIsNewEquipmentModalOpen,
    addEquipment,
    switchView
  } = useApp();

  const [name, setName] = useState('');
  const [cat, setCat] = useState('Звук');
  const [status, setStatus] = useState<EquipmentStatus>('stock');
  const [project, setProject] = useState<string>('');
  const [resp, setResp] = useState(state.team[0]?.id || 'u1');
  const [note, setNote] = useState('');

  if (!isNewEquipmentModalOpen) return null;

  const categories = ['Звук', 'Свет', 'Видео', 'Риггинг', 'Коммутация', 'Питание', 'Спецэффекты'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addEquipment({
      name: name.trim(),
      cat,
      status,
      project: status === 'project' && project ? project : null,
      lastCheck: D(0),
      resp,
      note: note.trim()
    });

    setName('');
    setNote('');
    setIsNewEquipmentModalOpen(false);
    switchView('equipment');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[500px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f59e0b]/15 text-[#f59e0b] flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#fafafa]">
                Оприходование оборудования
              </h3>
              <p className="text-[11px] text-[#71717a]">
                Постановка в инвентарную базу склада и назначение ТО
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewEquipmentModalOpen(false)}
            className="text-[#71717a] hover:text-[#fafafa] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Equipment Name */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                Наименование единицы / модель *
              </label>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Shure Axient AD4D Dual Receiver"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b]"
              />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#f59e0b]" />
                  <span>Категория</span>
                </label>
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#f59e0b] cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-[#18181b]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#10b981]" />
                  <span>Текущий статус</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#f59e0b] cursor-pointer"
                >
                  <option value="stock" className="bg-[#18181b]">На складе (Готов)</option>
                  <option value="project" className="bg-[#18181b]">На проекте (В работе)</option>
                  <option value="repair" className="bg-[#18181b]">В ремонте / ТО</option>
                  <option value="reserved" className="bg-[#18181b]">В резерве</option>
                  <option value="transit" className="bg-[#18181b]">В пути / Транзит</option>
                </select>
              </div>
            </div>

            {/* Conditional Project Selection */}
            {status === 'project' && (
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#38bdf8]" />
                  <span>На каком проекте задействовано</span>
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#f59e0b] cursor-pointer"
                >
                  <option value="" className="bg-[#18181b]">-- Выберите проект --</option>
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#18181b]">
                      {p.id} · {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Responsible Person */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#ec4899]" />
                <span>Ответственный техник / инженер</span>
              </label>
              <select
                value={resp}
                onChange={(e) => setResp(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] focus:outline-none focus:border-[#f59e0b] cursor-pointer"
              >
                {state.team.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#18181b]">
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5 flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#a1a1aa]" />
                <span>Примечание / Комплектация</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Кейс №12, кабели питания, антенны в комплекте..."
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[#27272a] bg-[#18181b]/50">
            <button
              type="button"
              onClick={() => setIsNewEquipmentModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#f59e0b] hover:bg-[#f59e0b]/90 text-[#09090b] shadow-md shadow-[#f59e0b]/20 transition-all cursor-pointer"
            >
              Оприходовать единицу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
