import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDistanceToNow, format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Shield, AlertCircle, Search, CalendarIcon, Download, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  meta: any;
  organizations?: { name: string };
}

interface AuditLogViewerProps {
  logs: AuditLog[];
}

const ACTION_CATEGORIES = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "suspend", label: "Suspend" },
  { value: "admin", label: "Admin" },
  { value: "login", label: "Login" },
  { value: "export", label: "Export" },
];

export const AuditLogViewer = ({ logs }: AuditLogViewerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('create')) return 'default';
    if (action.includes('update')) return 'secondary';
    return 'outline';
  };

  const isHighRisk = (action: string) => {
    return action.includes('delete') || action.includes('suspend') || action.includes('admin');
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesActor = log.actor?.toLowerCase().includes(q);
        const matchesAction = log.action?.toLowerCase().includes(q);
        const matchesOrg = log.organizations?.name?.toLowerCase().includes(q);
        const matchesMeta = JSON.stringify(log.meta)?.toLowerCase().includes(q);
        if (!matchesActor && !matchesAction && !matchesOrg && !matchesMeta) return false;
      }

      // Action category filter
      if (actionFilter !== "all" && !log.action?.toLowerCase().includes(actionFilter)) {
        return false;
      }

      // Date range filter
      const logDate = new Date(log.created_at);
      if (dateFrom && isBefore(logDate, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(logDate, endOfDay(dateTo))) return false;

      return true;
    });
  }, [logs, searchQuery, actionFilter, dateFrom, dateTo]);

  const hasFilters = searchQuery || actionFilter !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchQuery("");
    setActionFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const exportCSV = () => {
    const headers = ["Timestamp", "Organization", "Actor", "Action", "Details"];
    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.organizations?.name || "N/A",
      log.actor || "",
      log.action || "",
      JSON.stringify(log.meta || {}),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>{filteredLogs.length} of {logs.length} entries</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actor, action, org…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM d") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM d") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Table — desktop */}
        <ScrollArea className="h-[600px]">
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className={cn("border rounded-lg p-3 space-y-2", isHighRisk(log.action) && "border-destructive/40 bg-destructive/5")}>
                <div className="flex items-center justify-between">
                  <Badge variant={getActionColor(log.action)} className="text-xs">
                    {isHighRisk(log.action) && <AlertCircle className="h-3 w-3 mr-1" />}
                    {log.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Actor: </span>
                  <span className="font-medium">{log.actor}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Org: </span>
                  <span>{log.organizations?.name || "N/A"}</span>
                </div>
                {log.meta && (
                  <div className="text-xs text-muted-foreground break-all">
                    {JSON.stringify(log.meta).slice(0, 120)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit logs match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className={isHighRisk(log.action) ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-sm whitespace-nowrap">
                      <div>{format(new Date(log.created_at), "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{log.organizations?.name || 'N/A'}</span>
                    </TableCell>
                    <TableCell className="text-sm">{log.actor}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isHighRisk(log.action) && <AlertCircle className="h-4 w-4 text-destructive" />}
                        <Badge variant={getActionColor(log.action)}>{log.action}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-md truncate">
                      {JSON.stringify(log.meta)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
