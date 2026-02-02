
export class KeyedTaskQueue {
  private queues = new Map<string, Promise<void>>();
  private timers = new Map<string, NodeJS.Timeout>();
  private ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  enqueue(key: string, task: () => Promise<void>): void {
    const previous = this.queues.get(key) || Promise.resolve();
    
    const next = previous.then(async () => {
      try {
        await task();
      } catch (err) {
        console.error(`[WeCom] Queue task error for ${key}:`, err);
      }
    });

    this.queues.set(key, next);
    this.touch(key);
  }

  private touch(key: string) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    const timer = setTimeout(() => {
      this.queues.delete(key);
      this.timers.delete(key);
    }, this.ttlMs);
    
    // Don't prevent process exit
    if (timer.unref) timer.unref();
    
    this.timers.set(key, timer);
  }
}
