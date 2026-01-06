// Event bus for protocol events

type EventCallback = (...args: unknown[]) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  }

  once(event: string, callback: EventCallback): void {
    const wrapper = (...args: unknown[]) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

export const eventBus = new EventBus();

export const PROTOCOL_EVENTS = {
  BLOCK_MINED: 'protocol:block_mined',
  MESSAGE_SENT: 'protocol:message_sent',
  MESSAGE_RECEIVED: 'protocol:message_received',
  ENTITY_CREATED: 'protocol:entity_created',
  ENTITY_UPDATED: 'protocol:entity_updated',
  CONVERSATION_CREATED: 'protocol:conversation_created',
  JOB_CREATED: 'protocol:job_created',
  JOB_UPDATED: 'protocol:job_updated',
  ERROR: 'protocol:error',
} as const;
