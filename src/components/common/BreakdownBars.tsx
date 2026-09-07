import React from 'react';
import { ProjectBreakdown } from '../../types';
import { pctColor } from '../../data/seedData';

interface BreakdownBarsProps {
  breakdown: ProjectBreakdown;
  isLarge?: boolean;
}

const LABELS: Record<keyof ProjectBreakdown, string> = {
  team: 'Команда',
  equipment: 'Оборудование',
  logistics: 'Логистика',
  content: 'Контент',
  documents: 'Документы'
};

export const BreakdownBars: React.FC<BreakdownBarsProps> = ({ breakdown, isLarge = false }) => {
  const keys = Object.keys(LABELS) as (keyof ProjectBreakdown)[];

  return (
    <div className={`grid ${isLarge ? 'gap-2.5' : 'gap-1.5'} w-full`}>
      {keys.map((k) => {
        const val = breakdown[k];
        const color = pctColor(val);
        return (
          <div
            key={k}
            className={`flex items-center gap-2 ${
              isLarge ? 'text-xs text-[#a1a1aa]' : 'text-[11px] text-[#71717a]'
            }`}
          >
            <span
              className={`flex-none truncate ${
                isLarge ? 'w-28 text-[#a1a1aa]' : 'w-20'
              }`}
            >
              {LABELS[k]}
            </span>
            <div
              className={`flex-1 rounded-full bg-[#27272a] overflow-hidden ${
                isLarge ? 'h-2' : 'h-1.5'
              }`}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${val}%`,
                  backgroundColor: color
                }}
              />
            </div>
            <span
              className={`font-mono text-right flex-none ${
                isLarge ? 'w-8 text-[#fafafa] font-semibold' : 'w-7 text-[#a1a1aa]'
              }`}
            >
              {val}%
            </span>
          </div>
        );
      })}
    </div>
  );
};
