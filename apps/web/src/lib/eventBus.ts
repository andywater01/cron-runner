/**
 * Client-side fan-out for server events.
 *
 * `useServerEvents` owns the single EventSource and republishes everything here, so any
 * component can subscribe (e.g. live run output) without opening another connection.
 */
import type { ServerEvent } from "@cronrunner/shared";

type Listener = (event: ServerEvent) => void;

const listeners = new Set<Listener>();

export function publishClientEvent(event: ServerEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[events] listener threw", err);
    }
  }
}

export function subscribeClientEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
