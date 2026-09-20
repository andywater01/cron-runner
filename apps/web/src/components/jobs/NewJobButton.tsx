import { ChevronDown, Plus, Sparkles, SquarePen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

/** Split button: primary action opens the AI builder, the caret offers both modes. */
export function NewJobButton() {
  const navigate = useNavigate();
  return (
    <div className="flex items-stretch">
      <Button
        variant="primary"
        className="rounded-r-none"
        onClick={() => navigate("/jobs/new?mode=ai")}
        icon={<Plus className="size-4" />}
      >
        New job
      </Button>
      <DropdownMenu
        label="Choose how to create a job"
        triggerClassName="h-9 w-7 rounded-l-none border-l border-accent-500/40 bg-accent-600 text-white hover:bg-accent-700"
        trigger={<ChevronDown className="size-3.5" />}
        items={[
          {
            label: "Describe with AI",
            icon: <Sparkles className="size-3.5" />,
            onSelect: () => navigate("/jobs/new?mode=ai"),
          },
          {
            label: "Create manually",
            icon: <SquarePen className="size-3.5" />,
            onSelect: () => navigate("/jobs/new"),
          },
        ]}
      />
    </div>
  );
}
