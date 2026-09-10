'use client';

import { Trophy } from 'lucide-react';
import { ComingSoon } from '@/components/shared/ComingSoon';

export function StudentLeaderboard() {
  return (
    <ComingSoon
      icon={Trophy}
      title="Leaderboard isn't live yet"
      description="A real leaderboard needs a points system and a privacy design for comparing your standing against named classmates — neither exists yet, so this used to show fabricated names and scores. Check your real rank per exam on the My Tests screen instead."
    />
  );
}
