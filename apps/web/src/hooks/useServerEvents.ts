/**
 * Keeps one EventSource open to /api/events and invalidates react-query caches when
 * jobs or runs change, so every view stays live without polling.
 */

import type { ServerEvent } from "@cronrunner/shared";
import { API_PREFIX } from "@cronrunner/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "@/lib/queryKeys";

export function useServerEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource(`${API_PREFIX}/events`);
    const handle = (e: MessageEvent) => {
      const event = JSON.parse(e.data) as ServerEvent;
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
    for (const t of ["run.started", "run.finished", "job.changed", "job.deleted"]) {
      es.addEventListener(t, handle as EventListener);
    }
    return () => es.close();
  }, [qc]);
}
