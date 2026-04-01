import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, Phone, Mail, Calendar, AlertTriangle, Linkedin, User } from "lucide-react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import type { LeadTask } from "@/hooks/use-tasks";

const tierColors: Record<string, string> = {
  P1: "bg-red-500/10 text-red-600 border-red-500/30",
  P2: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  P3: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

const taskTypeIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  demo: Calendar,
  follow_up: Clock,
  linkedin: Linkedin,
  meeting: Calendar,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
};

interface TaskCardProps {
  task: LeadTask;
  onComplete: (id: string) => void;
  onStartProgress: (id: string) => void;
}

export function TaskCard({ task, onComplete, onStartProgress }: TaskCardProps) {
  const Icon = taskTypeIcons[task.task_type] || Clock;
  const isOverdue = task.status !== "completed" && new Date(task.due_at) < new Date();
  const displayStatus = isOverdue && task.status === "pending" ? "overdue" : task.status;

  // Due-date warning: within 4 hours
  const hoursUntilDue = differenceInHours(new Date(task.due_at), new Date());
  const isDueSoon = !isOverdue && task.status !== "completed" && hoursUntilDue >= 0 && hoursUntilDue <= 4;

  return (
    <Card className={isOverdue && task.status !== "completed" ? "border-destructive/40" : isDueSoon ? "border-amber-400/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{task.title}</p>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={statusColors[displayStatus] || ""}>
                  {displayStatus}
                </Badge>
                {task.title.match(/^\[(P[123])\]/) && (
                  <Badge variant="outline" className={tierColors[task.title.match(/^\[(P[123])\]/)![1]] || ""}>
                    {task.title.match(/^\[(P[123])\]/)![1]}
                  </Badge>
                )}

                {/* Assignee */}
                {task.assigned_to && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <User className="h-3 w-3" />
                        Assigned
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{task.assigned_to}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Due date */}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {isOverdue && task.status !== "completed" ? (
                    <><AlertTriangle className="h-3 w-3 text-destructive" /> Overdue by {formatDistanceToNow(new Date(task.due_at))}</>
                  ) : isDueSoon ? (
                    <><AlertTriangle className="h-3 w-3 text-amber-500" /> Due in {formatDistanceToNow(new Date(task.due_at))}</>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      Due {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {task.status === "pending" && (
              <Button size="sm" variant="outline" onClick={() => onStartProgress(task.id)}>
                Start
              </Button>
            )}
            {task.status !== "completed" && (
              <Button size="sm" variant="default" onClick={() => onComplete(task.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
