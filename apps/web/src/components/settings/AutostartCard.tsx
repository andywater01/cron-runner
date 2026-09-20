import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { api } from "@/lib/api";
import { qk } from "@/lib/queryKeys";

/** "Start CronRunner at login". Disabled with an explanation where it cannot work. */
export function AutostartCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const system = useSystemInfo();
  const autostart = system.data?.autostart;

  const toggle = useMutation({
    mutationFn: (next: boolean) => (next ? api.autostart.enable() : api.autostart.disable()),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.system });
      toast.success(
        result.enabled ? "CronRunner will start at login" : "Start at login turned off",
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change this"),
  });

  return (
    <div className="flex flex-col gap-2">
      <Switch
        checked={autostart?.enabled ?? false}
        disabled={!autostart?.supported || toggle.isPending}
        onChange={(next) => toggle.mutate(next)}
        label="Start CronRunner when I log in"
        showLabel
      />
      <p className="text-xs text-muted">
        {autostart?.supported
          ? "Jobs only run while CronRunner is running. Turn this on so it starts with your computer."
          : (autostart?.reason ?? "Checking…")}
      </p>
      {autostart?.supported && autostart.location && (
        <p className="font-mono text-[11px] text-muted">{autostart.location}</p>
      )}
    </div>
  );
}
