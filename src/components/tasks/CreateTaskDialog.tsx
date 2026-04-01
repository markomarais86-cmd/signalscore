import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTasks } from "@/hooks/use-tasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("call");
  const [leadId, setLeadId] = useState("");
  const [dueHours, setDueHours] = useState("1");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("self");
  const { userProfile, user } = useAuth();
  const { createTask } = useTasks();

  // Fetch team members for assignment
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .eq("org_id", userProfile.org_id);
      return data || [];
    },
    enabled: !!userProfile?.org_id && open,
  });

  const handleSubmit = () => {
    if (!title || !userProfile?.org_id) return;
    const dueAt = new Date(Date.now() + parseInt(dueHours) * 60 * 60 * 1000).toISOString();
    const resolvedAssignee = assignedTo === "self" ? (user?.id || null) : (assignedTo === "unassigned" ? null : assignedTo);
    createTask.mutate({
      org_id: userProfile.org_id,
      lead_id: leadId || "manual",
      lead_type: "manual",
      assigned_to: resolvedAssignee,
      task_type: taskType,
      title,
      description: description || null,
      due_at: dueAt,
      status: "pending",
      routing_rule_id: null,
    });
    setOpen(false);
    setTitle("");
    setDescription("");
    setLeadId("");
    setAssignedTo("self");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call lead about demo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due in (hours)</Label>
              <Input type="number" value={dueHours} onChange={(e) => setDueHours(e.target.value)} min="1" />
            </div>
          </div>
          <div>
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Myself</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers?.filter(m => m.user_id !== user?.id).map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.display_name || member.email || member.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lead ID (optional)</Label>
            <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="Lead email or ID" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional notes" />
          </div>
          <Button onClick={handleSubmit} disabled={!title} className="w-full">Create Task</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
