/** Temporary stand-in used by unimplemented pages. Delete once real pages exist. */
export function Placeholder({ what, plan }: { what: string; plan: string }) {
  return (
    <div className="rounded-card border border-dashed border-default bg-surface p-10 text-center">
      <p className="text-sm font-medium">{what} is not built yet.</p>
      <p className="mt-1 text-xs text-muted">See docs/PLAN.md {plan}</p>
    </div>
  );
}
