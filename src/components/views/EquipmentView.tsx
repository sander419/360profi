import React, { useState } from 'react';
import {
  PackagePlus,
  Download,
  Search,
  CheckCircle2,
  Wrench,
  Truck,
  Archive,
  ArrowRightLeft,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { fmtRu, daysLeft } from '../../data/seedData';
import { EquipmentStatus } from '../../types';
import { exportEquipmentToCsv } from '../../utils/exportCsv';

const STATUS_CONFIG: Record<
  EquipmentStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  stock: { label: 'На складе', color: 'text-[#10b981]', bg: 'bg-[#10b981]/15', border: 'border-[#10b981]/25' },
  project: { label: 'На проекте', color: 'text-[#6366f1]', bg: 'bg-[#6366f1]/15', border: 'border-[#6366f1]/25' },
  repair: { label: 'В ремонте', color: 'text-[#f43f5e]', bg: 'bg-[#f43f5e]/15', border: 'border-[#f43f5e]/25' },
  reserved: { label: 'Резерв', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/15', border: 'border-[#f59e0b]/25' },
  transit: { label: 'В пути', color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/15', border: 'border-[#8b5cf6]/25' }
};

export const EquipmentView: React.FC = () => {
  const {
    state,
    eqFilter,
    setEqFilter,
    checkEquipment,
    updateEquipmentStatus,
    setIsNewEquipmentModalOpen,
    userById,
    flashId
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const categories = [
    'all',
    'LED',
    'Свет',
    'Звук',
    'Камеры',
    'Трансляции',
    'Питание',
    'Риггинг'
  ];

  const getStatusCount = (s: EquipmentStatus) =>
    state.equipment.filter((q) => q.status === s).length;

  const filteredEquipment = state.equipment.filter((q) => {
    if (eqFilter.cat !== 'all' && q.cat !== eqFilter.cat) return false;
    if (selectedStatus !== 'all' && q.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const qText = searchQuery.trim().toLowerCase();
      const matchName = q.name.toLowerCase().includes(qText);
      const matchCat = q.cat.toLowerCase().includes(qText);
      const matchId = q.id.toLowerCase().includes(qText);
      const matchProject = q.project && q.project.toLowerCase().includes(qText);
      const matchNote = q.note && q.note.toLowerCase().includes(qText);
      if (!matchName && !matchCat && !matchId && !matchProject && !matchNote) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Main Actions */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
              Оборудование и склад
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] font-medium font-mono">
              {filteredEquipment.length} из {state.equipment.length} ед.
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Учет инвентаря, фиксация плановых ТО, статусы перемещений и прикрепление к проектам
          </p>
        </div>

        {/* Buttons: Export & Add */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => exportEquipmentToCsv(state.equipment, userById)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27272a] bg-[#18181b] text-xs font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] hover:bg-[#27272a]/50 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Экспорт ведомости оборудования в CSV (Excel)"
          >
            <Download className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>Экспорт CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewEquipmentModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#f59e0b] hover:bg-[#f59e0b]/90 text-[#09090b] text-xs font-semibold transition-all cursor-pointer shadow-md shadow-[#f59e0b]/20 active:scale-95"
            title="Оприходовать новое оборудование"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Оприходовать</span>
          </button>
        </div>
      </div>

      {/* Summary Counters Strip (Interactive Filter) */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-4 py-2.5 rounded-xl border transition-all text-left cursor-pointer ${
            selectedStatus === 'all'
              ? 'bg-[#27272a] border-[#3f3f46] shadow-sm'
              : 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]'
          }`}
        >
          <div className="font-mono text-xl font-bold text-[#fafafa]">
            {state.equipment.length}
          </div>
          <div className="text-xs font-medium text-[#a1a1aa]">Всего единиц</div>
        </button>

        {(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map((stKey) => {
          const cfg = STATUS_CONFIG[stKey];
          const isSelected = selectedStatus === stKey;
          return (
            <button
              key={stKey}
              onClick={() => setSelectedStatus(isSelected ? 'all' : stKey)}
              className={`border rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-sm transition-all cursor-pointer ${
                isSelected
                  ? `${cfg.bg} ${cfg.border} border-2 ring-1 ring-white/10`
                  : 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]'
              }`}
            >
              <span className={`font-mono text-xl font-bold ${cfg.color}`}>
                {getStatusCount(stKey)}
              </span>
              <span className="text-xs font-medium text-[#a1a1aa]">
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((c) => {
            const isActive = eqFilter.cat === c;
            return (
              <button
                key={c}
                onClick={() => setEqFilter((prev) => ({ ...prev, cat: c }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#6366f1] text-white shadow-sm'
                    : 'border border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                }`}
              >
                {c === 'all' ? 'Все категории' : c}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по модели, ID, проекту..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded-lg text-xs text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b]"
          />
        </div>
      </div>

      {/* Equipment Table Card */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-sm">
        {/* Table Header (Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-[#09090b]/80 text-[10.5px] font-medium tracking-wider uppercase text-[#71717a] border-b border-[#27272a]">
          <span className="col-span-4">Единица / Модель</span>
          <span className="col-span-2">Категория</span>
          <span className="col-span-2">Статус / Проект</span>
          <span className="col-span-2">Последняя проверка</span>
          <span className="col-span-2 text-right">Действие и ТО</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#27272a]">
          {filteredEquipment.length === 0 ? (
            <div className="p-8 text-center text-[#71717a] text-xs">
              Нет оборудования, соответствующего выбранным фильтрам
            </div>
          ) : (
            filteredEquipment.map((eq) => {
              const respUser = userById(eq.resp);
              const daysSinceCheck = daysLeft(eq.lastCheck);
              const isOverdueCheck = daysSinceCheck <= -30;
              const stCfg = STATUS_CONFIG[eq.status];
              const isFlashed = flashId === `eq-${eq.id}`;

              return (
                <div
                  key={eq.id}
                  id={`eq-${eq.id}`}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${
                    isFlashed ? 'animate-flash' : ''
                  }`}
                >
                  {/* Name, ID & Note */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#71717a] px-1.5 py-0.5 rounded bg-[#09090b] border border-[#27272a]">
                        {eq.id}
                      </span>
                      <div className="font-medium text-[13px] text-[#fafafa]">
                        {eq.name}
                      </div>
                    </div>
                    {eq.note && (
                      <div className="text-[11px] text-[#f59e0b] font-medium mt-0.5">
                        {eq.note}
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#09090b] border border-[#27272a] text-[#a1a1aa]">
                      {eq.cat}
                    </span>
                  </div>

                  {/* Status & Project with quick status changer */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex text-[10.5px] font-medium px-2.5 py-0.5 rounded-full border ${stCfg.bg} ${stCfg.color} ${stCfg.border}`}
                      >
                        {stCfg.label}
                      </span>

                      {/* Quick status selector */}
                      <select
                        value={eq.status}
                        onChange={(e) =>
                          updateEquipmentStatus(eq.id, e.target.value as EquipmentStatus)
                        }
                        title="Сменить статус оборудования"
                        className="text-[10px] bg-[#09090b] text-[#a1a1aa] border border-[#27272a] rounded px-1 py-0.5 focus:outline-none focus:border-[#f59e0b] cursor-pointer"
                      >
                        <option value="stock">Склад</option>
                        <option value="project">Проект</option>
                        <option value="repair">Ремонт</option>
                        <option value="reserved">Резерв</option>
                        <option value="transit">Транзит</option>
                      </select>
                    </div>

                    {eq.project && (
                      <div className="font-mono text-[11px] text-[#71717a] mt-0.5">
                        {eq.project}
                      </div>
                    )}
                  </div>

                  {/* Last Check */}
                  <div className="col-span-2 font-mono text-xs">
                    <span
                      className={
                        isOverdueCheck ? 'text-[#f59e0b] font-semibold' : 'text-[#a1a1aa]'
                      }
                    >
                      {fmtRu(eq.lastCheck)} · {Math.abs(daysSinceCheck)} дн назад
                    </span>
                    {isOverdueCheck && (
                      <div className="text-[10px] text-[#f59e0b]">требуется ТО</div>
                    )}
                  </div>

                  {/* Responsible & Action Button */}
                  <div className="col-span-2 flex items-center justify-between md:justify-end gap-2.5">
                    {respUser && (
                      <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                        <Avatar name={respUser.name} size="sm" />
                        <span className="truncate hidden xl:inline">
                          {respUser.name.split(' ')[0]} {respUser.name.split(' ')[1]?.[0]}.
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => checkEquipment(eq.id)}
                      title="Зафиксировать прохождение планового ТО"
                      className="px-2.5 py-1 rounded-md border border-[#27272a] bg-[#09090b] text-[11px] font-medium text-[#a1a1aa] hover:text-[#10b981] hover:border-[#10b981] transition-all whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                      <span>ТО</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
