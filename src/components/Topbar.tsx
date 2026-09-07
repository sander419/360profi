import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  FolderKanban,
  CheckSquare,
  Box,
  RotateCcw,
  Volume2,
  VolumeX,
  Keyboard,
  Command,
  Plus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar } from './common/Avatar';
import { fmtRu, fmtRuFull, D } from '../data/seedData';
import { Project, Task, EquipmentItem, TeamMember } from '../types';

export const Topbar: React.FC = () => {
  const {
    state,
    switchView,
    openProject,
    setTaskFilter,
    triggerFlash,
    resetDemo,
    setMobileMenuOpen,
    getReadiness,
    setIsCommandPaletteOpen,
    setIsShortcutsOpen,
    setIsModalOpen,
    soundEnabled,
    toggleSound
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const query = searchQuery.trim().toLowerCase();

  const matchingProjects: Project[] = query.length >= 2
    ? state.projects.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.client.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.venue.toLowerCase().includes(query)
      )
    : [];

  const matchingTasks: Task[] = query.length >= 2
    ? state.tasks.filter((t) => t.title.toLowerCase().includes(query))
    : [];

  const matchingEquipment: EquipmentItem[] = query.length >= 2
    ? state.equipment.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.cat.toLowerCase().includes(query) ||
          (e.note && e.note.toLowerCase().includes(query))
      )
    : [];

  const matchingTeam: TeamMember[] = query.length >= 2
    ? state.team.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.role.toLowerCase().includes(query)
      )
    : [];

  const hasResults =
    matchingProjects.length > 0 ||
    matchingTasks.length > 0 ||
    matchingEquipment.length > 0 ||
    matchingTeam.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = (id: string) => {
    openProject(id);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleSelectTask = (id: string) => {
    setTaskFilter((prev) => ({ ...prev, status: 'all' }));
    switchView('tasks');
    setIsDropdownOpen(false);
    setSearchQuery('');
    setTimeout(() => {
      triggerFlash(`task-${id}`);
      const el = document.getElementById(`task-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSelectEquipment = (id: string) => {
    switchView('equipment');
    setIsDropdownOpen(false);
    setSearchQuery('');
    setTimeout(() => {
      triggerFlash(`eq-${id}`);
      const el = document.getElementById(`eq-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSelectTeam = (id: string) => {
    switchView('team');
    setIsDropdownOpen(false);
    setSearchQuery('');
    setTimeout(() => {
      triggerFlash(`team-${id}`);
      const el = document.getElementById(`team-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleReset = () => {
    if (window.confirm('Вернуть демо-данные штаба? Все ваши изменения сбросятся к исходным.')) {
      resetDemo();
    }
  };

  return (
    <header className="flex items-center gap-3 px-6 py-4 border-b border-[#27272a] bg-[#18181b]/95 backdrop-blur-md sticky top-0 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden p-2 rounded-lg border border-[#27272a] text-[#fafafa] hover:bg-white/5"
        aria-label="Открыть меню"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Global Search */}
      <div ref={searchRef} className="relative flex-1 max-w-[440px]">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setIsDropdownOpen(true);
            }}
            placeholder="Поиск или нажмите ⌘K для команд..."
            className="w-full pl-9 pr-14 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Открыть командную строку (⌘K)"
            className="absolute right-2 px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[10px] font-mono text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            ⌘K
          </button>
        </div>

        {/* Dropdown Results */}
        {isDropdownOpen && query.length >= 2 && (
          <div className="absolute top-12 left-0 right-0 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl max-h-[360px] overflow-y-auto z-50 divide-y divide-[#27272a] animate-in fade-in zoom-in-95 duration-150">
            {!hasResults ? (
              <div className="p-4 text-center text-xs text-[#a1a1aa]">
                Ничего не найдено по запросу «{searchQuery}»
              </div>
            ) : (
              <>
                {/* Projects */}
                {matchingProjects.length > 0 && (
                  <div>
                    <div className="text-[10px] tracking-[1.4px] uppercase text-[#71717a] font-semibold px-3.5 pt-3 pb-1">
                      Проекты
                    </div>
                    {matchingProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProject(p.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.04] text-left text-[13px] text-[#fafafa] transition-colors"
                      >
                        <FolderKanban className="w-4 h-4 text-[#6366f1] flex-none" />
                        <span className="truncate flex-1 font-medium">{p.title}</span>
                        <span className="font-mono text-xs text-[#a1a1aa] flex-none">
                          {getReadiness(p)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Tasks */}
                {matchingTasks.length > 0 && (
                  <div>
                    <div className="text-[10px] tracking-[1.4px] uppercase text-[#71717a] font-semibold px-3.5 pt-3 pb-1">
                      Задачи
                    </div>
                    {matchingTasks.slice(0, 5).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTask(t.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.04] text-left text-[13px] text-[#fafafa] transition-colors"
                      >
                        <CheckSquare className="w-4 h-4 text-[#8b5cf6] flex-none" />
                        <span className="truncate flex-1 font-medium">{t.title}</span>
                        <span className="font-mono text-xs text-[#a1a1aa] flex-none">
                          {fmtRu(t.due)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Equipment */}
                {matchingEquipment.length > 0 && (
                  <div>
                    <div className="text-[10px] tracking-[1.4px] uppercase text-[#71717a] font-semibold px-3.5 pt-3 pb-1">
                      Оборудование
                    </div>
                    {matchingEquipment.slice(0, 5).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => handleSelectEquipment(e.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.04] text-left text-[13px] text-[#fafafa] transition-colors"
                      >
                        <Box className="w-4 h-4 text-[#10b981] flex-none" />
                        <span className="truncate flex-1 font-medium">{e.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-[#27272a] text-[#a1a1aa] flex-none">
                          {e.cat}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Team */}
                {matchingTeam.length > 0 && (
                  <div>
                    <div className="text-[10px] tracking-[1.4px] uppercase text-[#71717a] font-semibold px-3.5 pt-3 pb-1">
                      Сотрудники
                    </div>
                    {matchingTeam.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectTeam(u.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.04] text-left text-[13px] text-[#fafafa] transition-colors"
                      >
                        <Avatar name={u.name} size="sm" />
                        <div className="truncate flex-1">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-[#71717a] ml-2 font-normal">
                            {u.role}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-[#a1a1aa] flex-none">
                          {u.load}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Date */}
      <div className="hidden lg:flex items-center font-mono text-xs text-[#a1a1aa] border border-[#27272a] px-3 py-1.5 rounded-lg whitespace-nowrap bg-[#09090b]">
        сегодня · {fmtRuFull(D(0))}
      </div>

      {/* Quick Task creation button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="hidden md:flex items-center gap-1.5 bg-[#6366f1] hover:bg-[#6366f1]/90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Задача</span>
        <kbd className="hidden xl:inline text-[9px] font-mono bg-white/20 px-1 py-0.2 rounded">N</kbd>
      </button>

      {/* Sound Toggle */}
      <button
        onClick={toggleSound}
        title={soundEnabled ? 'Звуковые оповещения включены (нажмите чтобы заглушить)' : 'Звуковые оповещения отключены (нажмите чтобы включить)'}
        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
          soundEnabled
            ? 'border-[#27272a] text-[#10b981] hover:bg-[#10b981]/10'
            : 'border-[#27272a] text-[#71717a] hover:bg-white/5'
        }`}
        aria-label="Переключить звук"
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      {/* Shortcuts modal trigger */}
      <button
        onClick={() => setIsShortcutsOpen(true)}
        title="Справка по горячим клавишам (?)"
        className="p-1.5 rounded-lg border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Горячие клавиши"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {/* Reset Demo Button */}
      <button
        onClick={handleReset}
        title="Вернуть демо-данные"
        className="flex items-center gap-1.5 border border-[#27272a] hover:border-[#6366f1] hover:text-[#fafafa] text-[#a1a1aa] bg-[#18181b] px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap active:scale-95 cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">Сброс демо</span>
      </button>

      {/* User Chip */}
      <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 border border-[#27272a] rounded-full bg-[#09090b]">
        <div className="w-7 h-7 rounded-full bg-[#6366f1] text-white font-bold text-[11px] flex items-center justify-center">
          АС
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-[12px] font-semibold text-[#fafafa] leading-tight">
            А. Соколов
          </div>
          <div className="text-[10px] text-[#71717a] font-medium leading-none">
            операционный директор
          </div>
        </div>
      </div>
    </header>
  );
};
