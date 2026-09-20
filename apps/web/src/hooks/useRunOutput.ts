/**
 * Output for one run, correct whether it is finished or still going.
 *
 * Finished run: the database copy returned by `GET /api/runs/:id` is complete and authoritative.
 *
 * Running run: the response carries the output captured so far plus `outputSeq`, the sequence
 * number of the last chunk it includes. We keep every `run.output` event we have seen and render
 * the snapshot followed by only the chunks newer than it. That is why opening a run half way
 * through shows the earlier output too, with no gap and no duplicated lines.
 */
import { useEffect, useState } from "react";
import { subscribeClientEvents } from "@/lib/eventBus";
import { useRun } from "./useRuns";

export interface RunOutput {
  stdout: string;
  stderr: string;
  /** True while output is arriving over SSE rather than being read from the database. */
  live: boolean;
}

interface Chunk {
  seq: number;
  stream: "stdout" | "stderr";
  text: string;
}

export function useRunOutput(runId: string | null): RunOutput {
  const { data: run } = useRun(runId);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [trackedRunId, setTrackedRunId] = useState(runId);

  // Drop buffered chunks the moment a different run is selected, during render rather than
  // in an effect, so we never show one run's output under another run's heading.
  if (trackedRunId !== runId) {
    setTrackedRunId(runId);
    setChunks([]);
  }

  useEffect(() => {
    if (!runId) return;
    return subscribeClientEvents((event) => {
      if (event.type !== "run.output" || event.runId !== runId) return;
      setChunks((prev) =>
        prev.some((c) => c.seq === event.seq)
          ? prev
          : [...prev, { seq: event.seq, stream: event.stream, text: event.chunk }],
      );
    });
  }, [runId]);

  if (run?.status !== "running") {
    return { stdout: run?.stdout ?? "", stderr: run?.stderr ?? "", live: false };
  }

  // Everything up to `outputSeq` is already inside the snapshot; append only what came after.
  const since = run.outputSeq ?? 0;
  const newer = chunks.filter((c) => c.seq > since).sort((a, b) => a.seq - b.seq);
  return {
    stdout:
      run.stdout +
      newer
        .filter((c) => c.stream === "stdout")
        .map((c) => c.text)
        .join(""),
    stderr:
      run.stderr +
      newer
        .filter((c) => c.stream === "stderr")
        .map((c) => c.text)
        .join(""),
    live: true,
  };
}
