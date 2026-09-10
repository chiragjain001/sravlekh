'use client';

import { Library } from 'lucide-react';
import { ComingSoon } from '@/components/shared/ComingSoon';

export function StudentResources() {
  return (
    <ComingSoon
      icon={Library}
      title="Resource library isn't live yet"
      description="A real study-resource library (notes, videos, past papers) needs its own content model — the previous version of this screen showed a fixed list where every download/play button did nothing. Ask your teacher for materials via the Doubt Center in the meantime."
    />
  );
}
