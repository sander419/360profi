import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Package,
  Users,
  Plus,
  Radio,
  DollarSign,
  Volume2,
  VolumeX,
  ArrowRight,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ViewType } from '../types';
import { HighlightMatch, hasMatch } from './common/HighlightMatch';

export const CommandPalette: React.FC = () => {
  const {
    state,
    curView,
    switchView,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setIsModalOpen,
    setIsNewProjectModalOpen,
    setIsNewEquipmentModalOpen,
    setIsNewTeamModalOpen,
    setIsShortcutsOpen,
    openProject,
    soundEnabled,
    toggleSound,
    pingTeamTelemetry,
    triggerBudgetThresholdCheck,
    resetDemo
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const q = query.toLowerCase().trim();

  // Search through entities with real-time multi-field & description support
  const matchingProjects = q
    ? state.projects.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          p.venue.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          hasMatch(p.title, q) ||
          hasMatch(p.description, q) ||
          hasMatch(p.client, q) ||
          hasMatch(p.venue, q) ||
          hasMatch(p.id, q)
      ).slice(0, 6)
    : [];

  const matchingTasks = q
    ? state.tasks.filter((t) => {
        const parentProj = state.projects.find((p) => p.id === t.project);
        return (
          t.title.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q) ||
          (parentProj && parentProj.title.toLowerCase().includes(q)) ||
          hasMatch(t.title, q) ||
          hasMatch(t.project, q) ||
          (parentProj && hasMatch(parentProj.title, q))
        );
      }).slice(0, 6)
    : [];

  const matchingEquipment = q
    ? state.equipment.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.cat.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          hasMatch(e.name, q) ||
          hasMatch(e.cat, q) ||
          hasMatch(e.id, q)
      ).slice(0, 5)
    : [];

  const matchingTeam = q
    ? state.team.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          hasMatch(m.name, q) ||
          hasMatch(m.role, q)
      ).slice(0, 5)
    : [];

  const handleAction = (action: () => void) => {
    action();
    setIsCommandPaletteOpen(false);
  };

  const navItems: { label: string; view: ViewType; icon: React.ReactNode; shortcut: string }[] = [
    { label: 'Штаб · Центр управления', view: 'hub', icon: <LayoutDashboard className="w-4 h-4 text-[#6366f1]" />, shortcut: '1' },
    { label: 'Проекты · Производство', view: 'projects', icon: <FolderKanban className="w-4 h-4 text-[#38bdf8]" />, shortcut: '2' },
    { label: 'Задачи · Канбан и вехи', view: 'tasks', icon: <CheckSquare className="w-4 h-4 text-[#10b981]" />, shortcut: '3' },
    { label: 'Оборудование · Склад и ТО', view: 'equipment', icon: <Package className="w-4 h-4 text-[#f59e0b]" />, shortcut: '4' },
    { label: 'Команда · Доступность и радио', view: 'team', icon: <Users className="w-4 h-4 text-[#ec4899]" />, shortcut: '5' }
  ];

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-150"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[620px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#27272a] gap-3">
          <Search className="w-5 h-5 text-[#a1a1aa] flex-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Быстрый поиск проекта, задачи, оборудования, команды или команды..."
            className="flex-1 bg-transparent border-none text-[14px] text-[#fafafa] placeholder-[#71717a] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#71717a] hover:text-[#fafafa] p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] border border-[#3f3f46]">
            ESC
          </span>
        </div>

        {/* Scrollable list of commands & results */}
        <div className="overflow-y-auto p-3 space-y-4 text-xs">
          {/* Quick Actions (always visible if query matches or is empty) */}
          {(!q || 'создать задача проект оборудование сотрудник радио звук сметы'.includes(q)) && (
            <div>
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-[#71717a]">
                Быстрые действия
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => handleAction(() => setIsModalOpen(true))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#6366f1]/15 text-[#6366f1] flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Создать новую задачу</div>
                      <div className="text-[11px] text-[#71717a]">С привязкой к проекту и ответственному</div>
                    </div>
                  </div>
                  <kbd className="px-2 py-0.5 rounded bg-[#09090b] border border-[#27272a] font-mono text-[10px] text-[#a1a1aa]">
                    N
                  </kbd>
                </button>

                <button
                  onClick={() => handleAction(() => setIsNewProjectModalOpen(true))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#38bdf8]/15 text-[#38bdf8] flex items-center justify-center">
                      <FolderKanban className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Открыть новый проект</div>
                      <div className="text-[11px] text-[#71717a]">Ввод сметы, клиента, площадки и вех</div>
                    </div>
                  </div>
                  <kbd className="px-2 py-0.5 rounded bg-[#09090b] border border-[#27272a] font-mono text-[10px] text-[#a1a1aa]">
                    P
                  </kbd>
                </button>

                <button
                  onClick={() => handleAction(() => setIsNewEquipmentModalOpen(true))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Оприходовать оборудование на склад</div>
                      <div className="text-[11px] text-[#71717a]">Регистрация серийного номера, категории и статуса</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleAction(() => setIsNewTeamModalOpen(true))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#ec4899]/15 text-[#ec4899] flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Зачислить специалиста в команду</div>
                      <div className="text-[11px] text-[#71717a]">Добавление инженера, рации, компетенций</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleAction(() => pingTeamTelemetry())}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#10b981]/15 text-[#10b981] flex items-center justify-center">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Радиоперекличка команды</div>
                      <div className="text-[11px] text-[#71717a]">Опрос каналов связи и статуса присутствия на объектах</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleAction(() => triggerBudgetThresholdCheck())}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#eab308]/15 text-[#eab308] flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Проверить бюджетные лимиты (80% / 95%)</div>
                      <div className="text-[11px] text-[#71717a]">Сканирование перерасходов по всем проектам</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    toggleSound();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/5 text-[#a1a1aa] flex items-center justify-center">
                      {soundEnabled ? <Volume2 className="w-4 h-4 text-[#10b981]" /> : <VolumeX className="w-4 h-4 text-[#f43f5e]" />}
                    </div>
                    <div>
                      <div className="font-medium">Звуковые эффекты штаба</div>
                      <div className="text-[11px] text-[#71717a]">{soundEnabled ? 'Включены (клик чтобы выключить)' : 'Выключены (клик чтобы включить)'}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${soundEnabled ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#27272a] text-[#71717a]'}`}>
                    {soundEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          {(!q || 'перейти штаб проекты задачи склад оборудование команда'.includes(q)) && (
            <div>
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-[#71717a]">
                Переход по разделам
              </div>
              <div className="space-y-1 mt-1">
                {navItems.map((item) => (
                  <button
                    key={item.view}
                    onClick={() => handleAction(() => switchView(item.view))}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      curView === item.view
                        ? 'bg-[#6366f1]/10 text-[#6366f1] font-semibold'
                        : 'text-[#fafafa] hover:bg-[#27272a]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <kbd className="px-2 py-0.5 rounded bg-[#09090b] border border-[#27272a] font-mono text-[10px] text-[#a1a1aa]">
                      {item.shortcut}
                    </kbd>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results: Projects */}
          {matchingProjects.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-[#38bdf8] flex items-center justify-between">
                <span>Проекты ({matchingProjects.length})</span>
                {q && (
                  <span className="text-[10px] text-[#71717a] font-normal lowercase hidden sm:inline">
                    подсветка в названии и описании
                  </span>
                )}
              </div>
              <div className="space-y-1.5 mt-1">
                {matchingProjects.map((p) => {
                  const isDescMatch = Boolean(p.description && hasMatch(p.description, q));
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        handleAction(() => {
                          openProject(p.id);
                          switchView('projects');
                        })
                      }
                      className="w-full flex flex-col p-3 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors cursor-pointer group border border-[#27272a]/50 hover:border-[#38bdf8]/40 bg-[#09090b]/40"
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <span className="font-mono text-[11px] text-[#38bdf8] font-bold px-1.5 py-0.5 rounded bg-[#38bdf8]/10 border border-[#38bdf8]/20 flex-none">
                            <HighlightMatch
                              text={p.id}
                              query={query}
                              highlightClassName="bg-[#38bdf8]/35 text-white font-bold px-0.5 rounded"
                            />
                          </span>
                          <span className="font-medium text-[13px] text-[#fafafa] truncate">
                            <HighlightMatch
                              text={p.title}
                              query={query}
                              highlightClassName="bg-[#38bdf8]/25 text-[#38bdf8] font-bold px-1 py-0.2 rounded border border-[#38bdf8]/40 shadow-xs"
                            />
                          </span>
                          <span className="text-[11px] text-[#71717a] truncate hidden sm:inline">
                            · <HighlightMatch
                              text={p.client}
                              query={query}
                              highlightClassName="bg-[#38bdf8]/20 text-[#38bdf8] font-semibold px-0.5 rounded"
                            />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-none">
                          <span className="text-[10.5px] font-mono text-[#a1a1aa] bg-[#09090b] px-2 py-0.5 rounded border border-[#27272a]">
                            {p.budget}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#38bdf8] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>

                      {/* Project Description Snippet with real-time match highlighting */}
                      {p.description && (
                        <div className="text-[11.5px] text-[#a1a1aa] line-clamp-2 mt-1.5 leading-relaxed pl-0.5 group-hover:text-[#d4d4d8] transition-colors">
                          <HighlightMatch
                            text={p.description}
                            query={query}
                            highlightClassName="bg-[#38bdf8]/30 text-[#e0f2fe] font-semibold px-1 py-0.2 rounded border border-[#38bdf8]/50 shadow-xs"
                          />
                        </div>
                      )}

                      {/* Venue, Date and match indicator */}
                      <div className="flex items-center gap-2 text-[10.5px] text-[#71717a] mt-1.5 pl-0.5 flex-wrap">
                        <span className="truncate max-w-[200px]">
                          📍 <HighlightMatch
                            text={p.venue}
                            query={query}
                            highlightClassName="bg-[#38bdf8]/20 text-[#38bdf8] font-semibold px-0.5 rounded"
                          />
                        </span>
                        <span>·</span>
                        <span>📅 {p.date}</span>
                        {isDescMatch && (
                          <span className="ml-auto text-[9.5px] font-mono text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/25 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> совпадение в описании
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results: Tasks */}
          {matchingTasks.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-[#10b981] flex items-center justify-between">
                <span>Задачи ({matchingTasks.length})</span>
                {q && (
                  <span className="text-[10px] text-[#71717a] font-normal lowercase hidden sm:inline">
                    подсветка в названии задач
                  </span>
                )}
              </div>
              <div className="space-y-1.5 mt-1">
                {matchingTasks.map((t) => {
                  const parentProj = state.projects.find((p) => p.id === t.project);
                  const assignee = state.team.find((m) => m.id === t.assignee);
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleAction(() => switchView('tasks'))}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors cursor-pointer group border border-[#27272a]/50 hover:border-[#10b981]/40 bg-[#09090b]/40"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-none ${
                              t.status === 'done'
                                ? 'bg-[#10b981]'
                                : t.status === 'inwork'
                                ? 'bg-[#6366f1]'
                                : 'bg-[#eab308]'
                            }`}
                          />
                          <span className="font-medium text-[13px] text-[#fafafa] truncate">
                            <HighlightMatch
                              text={t.title}
                              query={query}
                              highlightClassName="bg-[#10b981]/25 text-[#10b981] font-bold px-1 py-0.2 rounded border border-[#10b981]/40 shadow-xs"
                            />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#71717a] mt-1 pl-4 flex-wrap">
                          <span className="font-mono text-[10.5px] text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.2 rounded border border-[#10b981]/20">
                            <HighlightMatch
                              text={t.project}
                              query={query}
                              highlightClassName="bg-[#10b981]/30 text-white font-bold px-0.5 rounded"
                            />
                          </span>
                          {parentProj && (
                            <span className="truncate max-w-[200px]">
                              · <HighlightMatch
                                text={parentProj.title}
                                query={query}
                                highlightClassName="bg-[#10b981]/20 text-[#10b981] font-semibold px-0.5 rounded"
                              />
                            </span>
                          )}
                          {assignee && (
                            <span className="truncate hidden sm:inline text-[#a1a1aa]">
                              · {assignee.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            t.status === 'done'
                              ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                              : t.status === 'inwork'
                              ? 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/30'
                              : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a]'
                          }`}
                        >
                          {t.status === 'done' ? 'Готово' : t.status === 'inwork' ? 'В работе' : 'К выполнению'}
                        </span>
                        <span className="text-[10px] text-[#a1a1aa] font-mono hidden sm:inline">
                          {t.due}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#10b981] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results: Equipment */}
          {matchingEquipment.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-[#f59e0b]">
                Оборудование ({matchingEquipment.length})
              </div>
              <div className="space-y-1.5 mt-1">
                {matchingEquipment.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleAction(() => switchView('equipment'))}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors cursor-pointer group border border-[#27272a]/50 hover:border-[#f59e0b]/40 bg-[#09090b]/40"
                  >
                    <div className="truncate flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded border border-[#f59e0b]/20">
                        <HighlightMatch
                          text={e.id}
                          query={query}
                          highlightClassName="bg-[#f59e0b]/30 text-white font-bold px-0.5 rounded"
                        />
                      </span>
                      <span className="font-medium truncate">
                        <HighlightMatch
                          text={e.name}
                          query={query}
                          highlightClassName="bg-[#f59e0b]/25 text-[#f59e0b] font-bold px-1 rounded"
                        />
                      </span>
                      <span className="text-[11px] text-[#71717a]">
                        · <HighlightMatch
                          text={e.cat}
                          query={query}
                          highlightClassName="bg-[#f59e0b]/20 text-[#f59e0b] font-semibold px-0.5 rounded"
                        />
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#27272a] text-[#a1a1aa]">
                      {e.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results: Team */}
          {matchingTeam.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-[#ec4899]">
                Команда ({matchingTeam.length})
              </div>
              <div className="space-y-1.5 mt-1">
                {matchingTeam.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleAction(() => switchView('team'))}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#27272a] text-left text-[#fafafa] transition-colors cursor-pointer group border border-[#27272a]/50 hover:border-[#ec4899]/40 bg-[#09090b]/40"
                  >
                    <div className="truncate flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ec4899]" />
                      <span className="font-medium truncate">
                        <HighlightMatch
                          text={m.name}
                          query={query}
                          highlightClassName="bg-[#ec4899]/25 text-[#ec4899] font-bold px-1 rounded"
                        />
                      </span>
                      <span className="text-[11px] text-[#71717a]">
                        · <HighlightMatch
                          text={m.role}
                          query={query}
                          highlightClassName="bg-[#ec4899]/20 text-[#ec4899] font-semibold px-0.5 rounded"
                        />
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#a1a1aa]">{m.load}% загр.</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results message */}
          {q &&
            matchingProjects.length === 0 &&
            matchingTasks.length === 0 &&
            matchingEquipment.length === 0 &&
            matchingTeam.length === 0 && (
              <div className="p-8 text-center text-[#71717a]">
                <p className="text-sm text-[#a1a1aa]">Ничего не найдено по запросу «{query}»</p>
                <p className="text-xs mt-1">Попробуйте ввести название проекта, задачи или имя сотрудника</p>
              </div>
            )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 bg-[#09090b] border-t border-[#27272a] flex items-center justify-between text-[11px] text-[#71717a]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] font-mono text-[10px] mr-1">
                ?
              </kbd>
              Горячие клавиши
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] font-mono text-[10px] mr-1">
                1-5
              </kbd>
              Разделы
            </span>
          </div>
          <button
            onClick={() => handleAction(() => resetDemo())}
            className="flex items-center gap-1 hover:text-[#f43f5e] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Сброс демо</span>
          </button>
        </div>
      </div>
    </div>
  );
};
