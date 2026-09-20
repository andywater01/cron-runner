/**
 * In-process pub/sub used to push ServerEvents to SSE subscribers (see routes/events.ts).
 */
import type { ServerEvent } from "@cronrunner/shared";

type Listener = (event: ServerEvent) => void;
const listeners = new Set<Listener>();

export function publish(event: ServerEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (err) {
      console.error("[events] listener threw", err);
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
