import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { D } from '../data/seedData';
import { Task } from '../types';

export const NewTaskModal: React.FC = () => {
  const { state, isModalOpen, setIsModalOpen, addTask, switchView } = useApp();

  const [title, setTitle] = useState('');
  const [project, setProject] = useState(
    state.projects.find((p) => p.status === 'active')?.id || 'base'
  );
  const [assignee, setAssignee] = useState(state.team[0]?.id || 'u1');
  const [due, setDue] = useState(D(3));
  const [prio, setPrio] = useState<Task['prio']>('med');
  const [status, setStatus] = useState<Task['status']>('todo');

  if (!isModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      project,
      assignee,
      due,
      prio,
      status
    });

    setTitle('');
    setStatus('todo');
    setIsModalOpen(false);
    switchView('tasks');
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-[480px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <h3 className="font-bold text-[15px] text-[#fafafa]">
            Новая задача
          </h3>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-[#71717a] hover:text-[#fafafa] p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                Название задачи
              </label>
              <input
                type="text"
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: заказать кейтеринг-брифинг"
                className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-[13px] text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                  Проект
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-[13px] text-[#fafafa] focus:outline-none focus:border-[#6366f1] cursor-pointer"
                >
                  {state.projects
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#18181b]">
                        {p.id} · {p.title}
                      </option>
                    ))}
                  <option value="base" className="bg-[#18181b]">
                    Склад / база
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                  Ответственный
                </label>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-[13px] text-[#fafafa] focus:outline-none focus:border-[#6366f1] cursor-pointer"
                >
                  {state.team.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#18181b]">
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                  Срок выполнения
                </label>
                <input
                  type="date"
                  required
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-[13px] text-[#fafafa] focus:outline-none focus:border-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                  Приоритет
                </label>
                <select
                  value={prio}
                  onChange={(e) => setPrio(e.target.value as Task['prio'])}
                  className="w-full px-3.5 py-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-[13px] text-[#fafafa] focus:outline-none focus:border-[#6366f1] cursor-pointer"
                >
                  <option value="high" className="bg-[#18181b]">
                    Высокий
                  </option>
                  <option value="med" className="bg-[#18181b]">
                    Средний
                  </option>
                  <option value="low" className="bg-[#18181b]">
                    Низкий
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium tracking-[0.6px] uppercase text-[#71717a] mb-1.5">
                Колонка / Начальный статус
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'todo' as const, label: 'В очередь' },
                  { id: 'inwork' as const, label: 'В работу' },
                  { id: 'done' as const, label: 'Выполнено' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-center ${
                      status === s.id
                        ? 'bg-[#6366f1]/15 text-[#818cf8] border-[#6366f1]'
                        : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a] hover:border-[#3f3f46]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#27272a] bg-[#09090b]/50">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-[#27272a] bg-[#09090b] rounded-lg text-[13px] font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#6366f1] text-white hover:bg-[#4f46e5] active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Создать задачу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
