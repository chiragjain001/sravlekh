// ─── Offline Mutation Queue ────────────────────────────────────────────────────
// Queues mutations when offline, auto-syncs on reconnect.
// Survives page refresh via localStorage.
// Deduplicates mutations by idempotency key.

export interface QueuedMutation {
  id:          string;         // Idempotency key (UUID)
  type:        string;         // e.g. 'CREATE_ASSIGNMENT', 'MARK_ATTENDANCE'
  method:      'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url:         string;
  payload:     unknown;
  context:     Record<string, string>;  // instituteId, branchId, etc.
  queuedAt:    string;         // ISO string
  attempts:    number;
  maxAttempts: number;
  status:      'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

const QUEUE_KEY = 'aios_offline_queue';

export class OfflineQueue {
  private getQueue(): QueuedMutation[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedMutation[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      console.warn('[OfflineQueue] Failed to persist queue');
    }
  }

  enqueue(mutation: Omit<QueuedMutation, 'queuedAt' | 'attempts' | 'status'>): void {
    const queue = this.getQueue();
    // Deduplicate by id
    if (queue.find(m => m.id === mutation.id)) return;
    queue.push({ ...mutation, queuedAt: new Date().toISOString(), attempts: 0, status: 'pending' });
    this.saveQueue(queue);
  }

  dequeue(id: string): void {
    const queue = this.getQueue().filter(m => m.id !== id);
    this.saveQueue(queue);
  }

  getAll(): QueuedMutation[] {
    return this.getQueue();
  }

  getPending(): QueuedMutation[] {
    return this.getQueue().filter(m => m.status === 'pending');
  }

  getCount(): number {
    return this.getQueue().length;
  }

  markSyncing(id: string): void {
    const queue = this.getQueue().map(m =>
      m.id === id ? { ...m, status: 'syncing' as const, attempts: m.attempts + 1 } : m
    );
    this.saveQueue(queue);
  }

  markFailed(id: string, error: string): void {
    const queue = this.getQueue().map(m =>
      m.id === id ? { ...m, status: 'failed' as const, errorMessage: error } : m
    );
    this.saveQueue(queue);
  }

  clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  }
}

// Singleton
export const offlineQueue = new OfflineQueue();
