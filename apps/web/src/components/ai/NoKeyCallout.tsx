import { KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

/** Shown wherever an AI action is offered but no provider key is configured. */
export function NoKeyCallout({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-default bg-surface-muted px-3.5 py-3">
      <KeyRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <p className="text-xs leading-relaxed text-muted">
        Add an OpenAI or Anthropic API key in{" "}
        <Link
          to="/settings"
          className="font-medium text-accent-600 hover:underline dark:text-accent-300"
        >
          Settings
        </Link>{" "}
        to {what}. Your key stays on this machine.
      </p>
    </div>
  );
}
