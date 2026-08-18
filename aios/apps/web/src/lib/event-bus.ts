// ─── Frontend Event Bus ────────────────────────────────────────────────────────
// Event-driven architecture: mutations emit ONE event, listeners update independently.
//
// Usage (emit):   eventBus.emit('ASSIGNMENT_CREATED', { ... });
// Usage (listen): const unsub = eventBus.on('ASSIGNMENT_CREATED', handler);
//                 useEffect(() => unsub, []); // cleanup

export interface AiosEventMap {
  ASSIGNMENT_CREATED:    { assignmentId: string; batchId: string; teacherId: string };
  ASSIGNMENT_PUBLISHED:  { assignmentId: string; batchId: string; publishMode: string };
  ASSIGNMENT_UPDATED:    { assignmentId: string; batchId: string };
  ASSIGNMENT_ARCHIVED:   { assignmentId: string; batchId: string };
  ASSIGNMENT_RESTORED:   { assignmentId: string; batchId: string };
  ASSIGNMENT_SUBMITTED:  { assignmentId: string; studentId: string; batchId: string };
  ASSIGNMENT_GRADED:     { assignmentId: string; studentId: string; score: number };
  TEST_CREATED:          { testId: string; batchIds: string[]; teacherId: string };
  TEST_PUBLISHED:        { testId: string; batchIds: string[] };
  TEST_SUBMITTED:        { testId: string; studentId: string };
  TEST_GRADED:           { testId: string; studentId: string; score: number; batchId: string };
  TEST_RESULT_FINALIZED: { testId: string; batchId: string };
  DOUBT_SUBMITTED:       { doubtId: string; studentId: string; batchId: string; topic: string };
  DOUBT_ASSIGNED:        { doubtId: string; teacherId: string };
  DOUBT_RESOLVED:        { doubtId: string; studentId: string };
  BATCH_SWITCHED:        { fromBatchId: string | null; toBatchId: string };
  CONTEXT_CHANGED:       { field: string; oldValue: unknown; newValue: unknown };
  NAV_CHANGED:           { nav: string; role: string };
  DRAFT_SAVED:           { draftKey: string; wizardType: string };
  DRAFT_RESTORED:        { draftKey: string; wizardType: string };
  DRAFT_CLEARED:         { draftKey: string; wizardType: string };
  WENT_OFFLINE:          Record<string, never>;
  CAME_ONLINE:           { queuedMutations: number };
  MUTATION_QUEUED:       { id: string; type: string };
  MUTATION_SYNCED:       { id: string; type: string };
  SESSION_EXPIRED:       Record<string, never>;
  PERMISSION_DENIED:     { permission: string; role: string };
  ERROR_OCCURRED:        { code: string; message: string; context?: string };
}

export type AiosEvent = keyof AiosEventMap;
export type EventPayload<E extends AiosEvent> = AiosEventMap[E];
export type EventHandler<E extends AiosEvent> = (payload: EventPayload<E>) => void;

type Listeners = { [E in AiosEvent]?: Set<EventHandler<E>> };

class EventBus {
  private listeners: Listeners = {};

  on<E extends AiosEvent>(event: E, handler: EventHandler<E>): () => void {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.listeners[event] = new Set() as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners[event] as any).add(handler);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => (this.listeners[event] as any)?.delete(handler);
  }

  emit<E extends AiosEvent>(event: E, payload: EventPayload<E>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = this.listeners[event] as Set<EventHandler<E>> | undefined;
    if (!handlers) return;
    handlers.forEach(h => { try { h(payload); } catch (err) { console.error(`[EventBus] "${event}":`, err); } });
  }

  off<E extends AiosEvent>(event: E, handler: EventHandler<E>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners[event] as any)?.delete(handler);
  }


  clear(event?: AiosEvent): void {
    if (event) delete this.listeners[event]; else this.listeners = {};
  }
}

export const eventBus = new EventBus();
