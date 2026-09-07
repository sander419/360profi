import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2.5 pointer-events-none max-w-[380px] w-full">
      {toasts.map((toast) => {
        const borderColors = {
          ok: 'border-l-[#10b981]',
          warn: 'border-l-[#f59e0b]',
          bad: 'border-l-[#f43f5e]',
          acc: 'border-l-[#6366f1]'
        };
        const borderColor = toast.type ? borderColors[toast.type] : borderColors.ok;

        const iconColors = {
          ok: 'text-[#10b981]',
          warn: 'text-[#f59e0b]',
          bad: 'text-[#f43f5e]',
          acc: 'text-[#6366f1]'
        };

        const IconComponent =
          toast.type === 'bad' || toast.type === 'warn'
            ? AlertTriangle
            : toast.type === 'ok'
            ? CheckCircle2
            : Info;

        return (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`pointer-events-auto bg-[#18181b] border border-[#27272a] border-l-4 ${borderColor} rounded-xl p-3.5 text-xs text-[#fafafa] shadow-2xl transition-all animate-in fade-in slide-in-from-right-8 duration-200 cursor-pointer hover:bg-[#27272a]/50 group`}
          >
            <div className="flex items-start gap-2.5">
              <IconComponent
                className={`w-4 h-4 flex-none mt-0.5 ${
                  toast.type ? iconColors[toast.type] : iconColors.ok
                }`}
              />
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="font-semibold text-[13px] text-[#fafafa] mb-1 leading-snug flex items-center justify-between">
                    <span>{toast.title}</span>
                  </div>
                )}
                <div className="font-medium text-[#d4d4d8] leading-relaxed">
                  {toast.message}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                className="text-[#71717a] hover:text-[#fafafa] p-0.5 rounded transition-colors opacity-60 group-hover:opacity-100 flex-none"
                aria-label="Закрыть уведомление"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

