// ─── Feature Flags System ─────────────────────────────────────────────────────
// Config-driven: features are enabled/disabled per institute by FOUNDER.
// Frontend reads from AuthenticatedUser.featureFlags — never hardcodes if/else.
//
// Usage:
//   const { isEnabled } = useFeatureFlag();
//   if (isEnabled('aiAssignments')) { ... }

import type { FeatureFlags } from '@/types/academic-context.types';

// ── Default flags (conservative — all disabled until explicitly enabled)
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  aiAssignments:          false,
  aiPaperBuilder:         false,
  personalizedTests:      false,
  parentPortal:           false,
  offlineMode:            false,
  globalSearch:           true,   // Always on
  auditTrail:             true,   // Always on
  advancedAnalytics:      false,
  doubleSubmitPrevention: true,   // Always on
  undoActions:            true,   // Always on
  offlineQueue:           false,
};

// ── Demo-mode flags (for client presentations — all premium features on)
export const DEMO_FEATURE_FLAGS: FeatureFlags = {
  aiAssignments:          true,
  aiPaperBuilder:         true,
  personalizedTests:      true,
  parentPortal:           true,
  offlineMode:            true,
  globalSearch:           true,
  auditTrail:             true,
  advancedAnalytics:      true,
  doubleSubmitPrevention: true,
  undoActions:            true,
  offlineQueue:           true,
};
