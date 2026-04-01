import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadTask } from "@/hooks/use-tasks";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";

interface TaskCalendarViewProps {
  tasks: LeadTask[];
  onComplete: (id: string) => void;
  onStartProgress: (id: string) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/80",
  in_progress: "bg-blue-500/80",
  completed: "bg-green-500/80",
};

export function TaskCalendarView({ tasks, onComplete, onStartProgress }: TaskCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, LeadTask[]>();
    tasks.forEach((task) => {
      const key = format(new Date(task.due_at), "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    });
    return map;
  }, [tasks]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{format(currentMonth, "MMMM yyyy")}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const overdue = dayTasks.filter(
              (t) => t.status !== "completed" && new Date(t.due_at) < new Date()
            );

            return (
              <div
                key={key}
                className={cn(
                  "min-h-[80px] bg-card p-1 transition-colors",
                  !inMonth && "bg-muted/30",
                  today && "ring-1 ring-inset ring-primary/40"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none",
                    !inMonth && "text-muted-foreground/50",
                    today && "text-primary font-bold"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="mt-0.5 space-y-0.5 max-h-[60px] overflow-auto">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      onClick={() =>
                        task.status === "pending" ? onStartProgress(task.id) : onComplete(task.id)
                      }
                      className={cn(
                        "w-full text-left text-[9px] leading-tight px-1 py-0.5 rounded truncate",
                        statusColors[task.status] || "bg-muted",
                        "text-white hover:opacity-80 transition-opacity"
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] text-muted-foreground pl-1">
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
