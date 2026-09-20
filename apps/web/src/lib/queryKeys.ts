export const qk = {
  system: ["system"] as const,
  jobs: ["jobs"] as const,
  job: (id: string) => ["jobs", id] as const,
  jobRuns: (id: string) => ["jobs", id, "runs"] as const,
  recentRuns: ["runs", "recent"] as const,
  run: (id: string) => ["runs", id] as const,
  settings: ["settings"] as const,
};
