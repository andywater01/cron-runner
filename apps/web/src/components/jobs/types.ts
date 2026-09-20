/** Shape returned by POST /api/jobs/validate-schedule. */
export interface ScheduleValidation {
  valid: boolean;
  error?: string;
  human: string | null;
  next: string[];
}
