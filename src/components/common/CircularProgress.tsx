import React from 'react';
import { pctColor } from '../../data/seedData';

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  showPercentSign?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 52,
  strokeWidth = 5,
  showPercentSign = false
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);
  const color = pctColor(value);

  return (
    <div
      className="relative flex-none inline-flex items-center justify-center"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 transform"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#27272a"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-mono font-bold select-none"
        style={{
          fontSize: `${size / 3.4}px`,
          color: color
        }}
      >
        {value}
        {showPercentSign && <span className="text-[10px] ml-0.5 opacity-80">%</span>}
      </div>
    </div>
  );
};
