import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/queryKeys";

export function useSystemInfo() {
  return useQuery({ queryKey: qk.system, queryFn: api.system, refetchInterval: 30_000 });
}
