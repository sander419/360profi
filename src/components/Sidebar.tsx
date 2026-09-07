import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Box,
  Users,
  BookOpen,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ViewType, SoonKey } from '../types';
import { IMG } from '../data/seedData';

interface NavMainItem {
  key: ViewType;
  title: string;
  icon: React.ReactNode;
}

interface NavSoonItem {
  key: SoonKey;
  title: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const {
    curView,
    switchView,
    soonKey,
    setSoonKey,
    state,
    isOverdue,
    mobileMenuOpen,
    setMobileMenuOpen
  } = useApp();

  const activeProjectsCount = state.projects.filter((p) => p.status === 'active').length;
  const overdueTasksCount = state.tasks.filter((t) => isOverdue(t)).length;
  const inRepairEqCount = state.equipment.filter((q) => q.status === 'repair').length;

  const navMain: NavMainItem[] = [
    { key: 'hub', title: 'Штаб · обзор', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { key: 'projects', title: 'Проекты', icon: <FolderKanban className="w-[18px] h-[18px]" /> },
    { key: 'tasks', title: 'Задачи', icon: <CheckSquare className="w-[18px] h-[18px]" /> },
    { key: 'equipment', title: 'Оборудование', icon: <Box className="w-[18px] h-[18px]" /> },
    { key: 'team', title: 'Команда', icon: <Users className="w-[18px] h-[18px]" /> }
  ];

  const navSoon: NavSoonItem[] = [
    { key: 'kb', title: 'База знаний', icon: <BookOpen className="w-[18px] h-[18px]" /> },
    { key: 'academy', title: '360 Academy', icon: <GraduationCap className="w-[18px] h-[18px]" /> },
    { key: 'errors', title: 'Ошибки и разборы', icon: <AlertTriangle className="w-[18px] h-[18px]" /> },
    { key: 'analytics', title: 'Аналитика', icon: <BarChart3 className="w-[18px] h-[18px]" /> }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 w-[260px] bg-[#18181b] border-r border-[#27272a] flex flex-col p-5 gap-1.5 z-50 transition-transform duration-300 overflow-y-auto ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between pb-5 border-b border-[#27272a] mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center font-bold text-white shadow-sm flex-none">
              <span className="text-sm font-extrabold tracking-tighter">360</span>
            </div>
            <div>
              <div className="font-extrabold text-[15px] tracking-tight text-[#fafafa]">
                360PROFI
              </div>
              <div className="font-medium text-[10.5px] text-[#a1a1aa] tracking-[1.4px] uppercase">
                внутренний штаб
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-[#a1a1aa] hover:text-[#fafafa] rounded-lg hover:bg-white/5"
            aria-label="Закрыть меню"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section: Management */}
        <div className="text-[10.5px] tracking-[1.4px] uppercase text-[#71717a] font-semibold px-3 pt-2 pb-1">
          Управление
        </div>

        <nav className="space-y-1">
          {navMain.map((item) => {
            const isActive = curView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => switchView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-[13.5px] transition-colors relative text-left group ${
                  isActive
                    ? 'bg-[#6366f1]/10 text-[#6366f1]'
                    : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/[0.04]'
                }`}
              >
                <span className={isActive ? 'text-[#6366f1]' : 'text-[#a1a1aa] group-hover:text-[#fafafa]'}>
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.title}</span>

                {item.key === 'projects' && activeProjectsCount > 0 && (
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[#a1a1aa] border border-[#27272a]">
                    {activeProjectsCount}
                  </span>
                )}

                {item.key === 'tasks' && overdueTasksCount > 0 && (
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/20">
                    {overdueTasksCount}
                  </span>
                )}

                {item.key === 'equipment' && inRepairEqCount > 0 && (
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/20">
                    {inRepairEqCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Section: Roadmap / Soon */}
        <div className="text-[10.5px] tracking-[1.4px] uppercase text-[#71717a] font-semibold px-3 pt-4 pb-1">
          В разработке
        </div>

        <nav className="space-y-1">
          {navSoon.map((item) => {
            const isActive = curView === 'soon' && soonKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setSoonKey(item.key);
                  switchView('soon');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-[13.5px] transition-colors relative text-left group ${
                  isActive
                    ? 'bg-[#6366f1]/10 text-[#6366f1]'
                    : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/[0.04]'
                }`}
              >
                <span className={isActive ? 'text-[#6366f1]' : 'text-[#a1a1aa] group-hover:text-[#fafafa]'}>
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-[#27272a] text-[#71717a]">
                  скоро
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer info box matching Sleek Interface tier card */}
        <div className="mt-auto pt-4">
          <div className="p-3.5 bg-[#09090b] border border-[#27272a] rounded-xl text-xs">
            <div className="text-[10px] font-semibold tracking-wider text-[#71717a] uppercase mb-1.5 flex items-center justify-between">
              <span>СТАТУС ШТАБА</span>
              <span className="font-mono text-[#a1a1aa]">v0.1</span>
            </div>
            <div className="font-medium text-[#fafafa] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span>Операции активны</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
