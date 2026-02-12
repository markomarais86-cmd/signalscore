import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export interface LeadTask {
  id: string;
  org_id: string;
  lead_id: string;
  lead_type: string;
  assigned_to: string | null;
  task_type: string;
  title: string;
  description: string | null;
  due_at: string;
  completed_at: string | null;
  status: string;
  routing_rule_id: string | null;
  created_at: string;
}

export function useTasks(filters?: { status?: string; task_type?: string }) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ["lead_tasks", userProfile?.org_id, filters],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      let query = supabase
        .from("lead_tasks")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .order("due_at", { ascending: true });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.task_type) query = query.eq("task_type", filters.task_type);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LeadTask[];
    },
    enabled: !!userProfile?.org_id,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LeadTask> }) => {
      const { error } = await supabase
        .from("lead_tasks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_tasks"] });
      toast({ title: "Task updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lead_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_tasks"] });
      toast({ title: "Task completed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: Omit<LeadTask, "id" | "created_at" | "completed_at">) => {
      const { error } = await supabase.from("lead_tasks").insert(task);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_tasks"] });
      toast({ title: "Task created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return {
    tasks: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    updateTask,
    completeTask,
    createTask,
  };
}
