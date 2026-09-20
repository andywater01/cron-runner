/**
 * Keeps one EventSource open to /api/events, republishes every event on the client bus,
 * and invalidates react-query caches so all views stay live without polling.
 *
 * `run.output` is deliberately excluded from invalidation: it arrives per chunk and is
 * consumed directly by `useRunOutput`.
 */

import type { ServerEvent } from "@cronrunner/shared";
import { API_PREFIX } from "@cronrunner/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { publishClientEvent } from "@/lib/eventBus";
import { qk } from "@/lib/queryKeys";

const EVENT_TYPES: ServerEvent["type"][] = [
  "run.started",
  "run.finished",
  "run.output",
  "job.changed",
  "job.deleted",
];

export function useServerEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource(`${API_PREFIX}/events`);

    const handle = (e: MessageEvent) => {
      let event: ServerEvent;
      try {
        event = JSON.parse(e.data) as ServerEvent;
      } catch {
        return;
      }
      publishClientEvent(event);

      switch (event.type) {
        case "run.started":
        case "run.finished":
          qc.invalidateQueries({ queryKey: qk.jobs });
          qc.invalidateQueries({ queryKey: qk.recentRuns });
          qc.invalidateQueries({ queryKey: qk.jobRuns(event.jobId) });
          qc.invalidateQueries({ queryKey: qk.run(event.runId) });
          break;
        case "job.changed":
        case "job.deleted":
          qc.invalidateQueries({ queryKey: qk.jobs });
          break;
        default:
          break;
      }
    };

    for (const type of EVENT_TYPES) es.addEventListener(type, handle as EventListener);
    return () => es.close();
  }, [qc]);
}
