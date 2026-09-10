'use client';

import type { LucideIcon } from 'lucide-react';

// Shared "honest placeholder" for screens that previously showed fully
// fabricated data with no backend behind it at all (a fake leaderboard, a
// fake document library, fabricated platform revenue, a fake integrations
// registry, a fake support-ticket queue). None of these are wiring gaps —
// each needs its own real product/scope decision (what "points" mean and a
// privacy design for peer comparison; a content taxonomy; whether billing is
// in scope at all) before a real version can be built. This is the honest
// state in the meantime, instead of numbers and actions that look real but
// aren't.
export function ComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full flex flex-col items-center justify-center text-center p-10">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
          <Icon className="w-7 h-7 text-slate-400" />
        </div>
        <h2 className="text-[18px] font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-[13.5px] text-slate-500 max-w-md">{description}</p>
      </div>
    </div>
  );
}
