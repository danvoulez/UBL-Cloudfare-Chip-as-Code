
type Handler<T> = (data: T) => void;

export class EventBus {
  private topics = new Map<string, Set<Handler<any>>>();

  on<T = any>(topic: string, handler: Handler<T>) {
    const set = this.topics.get(topic) ?? new Set();
    set.add(handler as Handler<any>);
    this.topics.set(topic, set);
    return () => this.off(topic, handler);
  }
  off<T = any>(topic: string, handler: Handler<T>) {
    const set = this.topics.get(topic);
    if (!set) return;
    set.delete(handler as Handler<any>);
    if (set.size === 0) this.topics.delete(topic);
  }
  emit<T = any>(topic: string, data: T) {
    const set = this.topics.get(topic);
    if (!set) return;
    for (const h of Array.from(set)) {
      try { (h as Handler<T>)(data); } catch {}
    }
  }
  clear() { this.topics.clear(); }
}

// Singleton for convenience (can be replaced in DI)
export const bus = new EventBus();
