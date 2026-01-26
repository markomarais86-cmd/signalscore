import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Json } from "@/integrations/supabase/types";

interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  records_processed: number | null;
  records_affected: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  progress_percentage: number | null;
  current_step: string | null;
  step_details: Json | null;
  live_metrics: Json | null;
}

interface AgentRegistry {
  id: string;
  agent_name: string;
  agent_type: string;
  status: string;
  health_score: number | null;
  avg_latency_ms: number | null;
  success_rate: number | null;
  total_invocations: number | null;
  last_heartbeat: string | null;
  capabilities: Json;
}

interface UseAgentRealtimeReturn {
  activeRuns: AgentRun[];
  registeredAgents: AgentRegistry[];
  isConnected: boolean;
  connectionError: string | null;
  refreshAgents: () => Promise<void>;
}

export function useAgentRealtime(): UseAgentRealtimeReturn {
  const { userProfile } = useAuth();
  const [activeRuns, setActiveRuns] = useState<AgentRun[]>([]);
  const [registeredAgents, setRegisteredAgents] = useState<AgentRegistry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const fetchActiveRuns = useCallback(async () => {
    if (!userProfile?.org_id) return;

    const { data, error } = await supabase
      .from("ai_agent_runs")
      .select("*")
      .in("status", ["running", "pending"])
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[useAgentRealtime] Error fetching runs:", error);
      return;
    }

    setActiveRuns(data || []);
  }, [userProfile?.org_id]);

  const fetchRegisteredAgents = useCallback(async () => {
    if (!userProfile?.org_id) return;

    const { data, error } = await supabase
      .from("ai_agent_registry")
      .select("*")
      .eq("org_id", userProfile.org_id)
      .order("agent_name");

    if (error) {
      console.error("[useAgentRealtime] Error fetching registry:", error);
      return;
    }

    setRegisteredAgents(data || []);
  }, [userProfile?.org_id]);

  const refreshAgents = useCallback(async () => {
    await Promise.all([fetchActiveRuns(), fetchRegisteredAgents()]);
  }, [fetchActiveRuns, fetchRegisteredAgents]);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    let runsChannel: RealtimeChannel | null = null;
    let registryChannel: RealtimeChannel | null = null;

    const setupSubscriptions = async () => {
      // Initial fetch
      await refreshAgents();

      // Subscribe to agent runs changes
      runsChannel = supabase
        .channel("agent-runs-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ai_agent_runs",
          },
          (payload) => {
            console.log("[useAgentRealtime] Agent run change:", payload.eventType);
            
            if (payload.eventType === "INSERT") {
              const newRun = payload.new as AgentRun;
              if (newRun.status === "running" || newRun.status === "pending") {
                setActiveRuns(prev => [newRun, ...prev]);
              }
            } else if (payload.eventType === "UPDATE") {
              const updatedRun = payload.new as AgentRun;
              setActiveRuns(prev => {
                const filtered = prev.filter(r => r.id !== updatedRun.id);
                if (updatedRun.status === "running" || updatedRun.status === "pending") {
                  return [updatedRun, ...filtered];
                }
                return filtered;
              });
            } else if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id: string }).id;
              setActiveRuns(prev => prev.filter(r => r.id !== deletedId));
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            setConnectionError(null);
          } else if (status === "CHANNEL_ERROR") {
            setIsConnected(false);
            setConnectionError("Failed to connect to realtime updates");
          }
        });

      // Subscribe to agent registry changes
      registryChannel = supabase
        .channel("agent-registry-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ai_agent_registry",
            filter: `org_id=eq.${userProfile.org_id}`,
          },
          (payload) => {
            console.log("[useAgentRealtime] Registry change:", payload.eventType);
            
            if (payload.eventType === "INSERT") {
              setRegisteredAgents(prev => [...prev, payload.new as AgentRegistry]);
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new as AgentRegistry;
              setRegisteredAgents(prev => 
                prev.map(a => a.id === updated.id ? updated : a)
              );
            } else if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id: string }).id;
              setRegisteredAgents(prev => prev.filter(a => a.id !== deletedId));
            }
          }
        )
        .subscribe();
    };

    setupSubscriptions();

    return () => {
      if (runsChannel) {
        supabase.removeChannel(runsChannel);
      }
      if (registryChannel) {
        supabase.removeChannel(registryChannel);
      }
    };
  }, [userProfile?.org_id, refreshAgents]);

  return {
    activeRuns,
    registeredAgents,
    isConnected,
    connectionError,
    refreshAgents,
  };
}

// Hook for subscribing to a specific agent run
export function useAgentRunProgress(runId: string | null) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }

    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      setIsLoading(true);

      // Initial fetch
      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .eq("id", runId)
        .single();

      if (!error && data) {
        setRun(data);
      }
      setIsLoading(false);

      // Subscribe to changes
      channel = supabase
        .channel(`agent-run-${runId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "ai_agent_runs",
            filter: `id=eq.${runId}`,
          },
          (payload) => {
            setRun(payload.new as AgentRun);
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [runId]);

  return { run, isLoading };
}
