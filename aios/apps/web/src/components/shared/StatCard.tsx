'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  icon?: React.ReactNode;
  link?: string;
  onLinkClick?: () => void;
  onClick?: () => void;
  color?: 'indigo' | 'emerald' | 'sky' | 'violet' | 'rose' | 'amber' | 'teal';
}

const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  ring: 'ring-indigo-100'  },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
  sky:     { bg: 'bg-sky-50',     icon: 'text-sky-600',     ring: 'ring-sky-100'     },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  ring: 'ring-violet-100'  },
  rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600',    ring: 'ring-rose-100'    },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'ring-amber-100'   },
  teal:    { bg: 'bg-teal-50',    icon: 'text-teal-600',    ring: 'ring-teal-100'    },
};

export function StatCard({
  label,
  value,
  change,
  changePositive = true,
  icon,
  link,
  onLinkClick,
  onClick,
  color = 'indigo',
}: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`card-sm flex flex-col justify-between gap-2 transition-all duration-200 min-w-0 max-w-full overflow-hidden ${
        onClick
          ? 'cursor-pointer hover:shadow-card-hover hover:border-slate-300 active:scale-[0.99] group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          : 'hover:shadow-card-hover'
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p
            className={`text-[12px] text-slate-500 font-medium truncate ${
              onClick ? 'group-hover:text-slate-700 transition-colors' : ''
            }`}
            title={label}
          >
            {label}
          </p>
          <p className="text-[20px] sm:text-[22px] font-bold text-slate-800 leading-tight mt-1 truncate">{value}</p>
        </div>
        {icon && (
          <div
            className={`p-2 rounded-xl ${c.bg} ${c.icon} ring-1 ${c.ring} flex-shrink-0 ${
              onClick ? 'group-hover:scale-105 transition-transform duration-200' : ''
            }`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1 min-w-0 gap-2">
        {change && (
          <div className={`flex items-center gap-1 text-[11px] sm:text-[11.5px] font-semibold truncate ${changePositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {changePositive
              ? <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
              : <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
            }
            <span className="truncate">{change}</span>
          </div>
        )}
        {link && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLinkClick?.();
            }}
            className="text-[11.5px] text-indigo-600 font-medium hover:underline ml-auto flex-shrink-0 cursor-pointer"
          >
            {link}
          </button>
        )}
      </div>
    </div>
  );
}
