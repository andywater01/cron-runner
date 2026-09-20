/**
 * Debounced server-side validation of a cron expression.
 * The editor form and the preview card both read this one query so they never disagree.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDebouncedValue } from "./useDebouncedValue";

export function useScheduleValidation(schedule: string, timezone: string | null) {
  const debounced = useDebouncedValue(schedule.trim(), 300);
  return useQuery({
    queryKey: ["schedule-validation", debounced, timezone],
    queryFn: () => api.jobs.validateSchedule(debounced, timezone),
    enabled: debounced.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}
