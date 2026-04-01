import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Loader2, CalendarDays, List } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { TaskCard } from "@/components/tasks/TaskCard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";

export default function Tasks() {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const { tasks, isLoading, completeTask, updateTask } = useTasks();

  const pending = tasks.filter((t) => t.status === "pending");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const completed = tasks.filter((t) => t.status === "completed");
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && new Date(t.due_at) < new Date()
  );

  const filteredTasks = activeTab === "all" ? tasks
    : activeTab === "overdue" ? overdue
    : tasks.filter((t) => t.status === activeTab);

  const handleComplete = (id: string) => completeTask.mutate(id);
  const handleStart = (id: string) => updateTask.mutate({ id, updates: { status: "in_progress" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Manage lead follow-up tasks and assignments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 transition-colors ${viewMode === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
          <CreateTaskDialog />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Pending
          </div>
          <p className="text-2xl font-bold mt-1">{pending.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4" /> In Progress
          </div>
          <p className="text-2xl font-bold mt-1">{inProgress.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Completed
          </div>
          <p className="text-2xl font-bold mt-1">{completed.length}</p>
        </div>
        <div className="rounded-lg border border-destructive/20 p-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Overdue
          </div>
          <p className="text-2xl font-bold mt-1 text-destructive">{overdue.length}</p>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <TaskCalendarView tasks={tasks} onComplete={handleComplete} onStartProgress={handleStart} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              All <Badge variant="secondary" className="ml-1.5">{tasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {overdue.length > 0 && (
                <Badge variant="destructive" className="ml-1.5">{overdue.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tasks found</p>
                <p className="text-sm">Tasks will appear here when leads are routed through your rules.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onStartProgress={handleStart}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
