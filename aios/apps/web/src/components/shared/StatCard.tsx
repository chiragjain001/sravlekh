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
  color = 'indigo',
}: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="card-sm flex flex-col gap-2 hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] text-slate-500 font-medium">{label}</p>
          <p className="text-[22px] font-bold text-slate-800 leading-none mt-1">{value}</p>
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${c.bg} ${c.icon} ring-1 ${c.ring}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        {change && (
          <div className={`flex items-center gap-1 text-[11.5px] font-semibold ${changePositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {changePositive
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />
            }
            {change}
          </div>
        )}
        {link && (
          <button
            onClick={onLinkClick}
            className="text-[11.5px] text-indigo-600 font-medium hover:underline ml-auto"
          >
            {link}
          </button>
        )}
      </div>
    </div>
  );
}
