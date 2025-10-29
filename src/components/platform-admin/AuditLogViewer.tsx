import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Shield, AlertCircle } from "lucide-react";

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

export const AuditLogViewer = ({ logs }: AuditLogViewerProps) => {
  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('create')) return 'default';
    if (action.includes('update')) return 'secondary';
    return 'outline';
  };

  const isHighRisk = (action: string) => {
    return action.includes('delete') || action.includes('suspend') || action.includes('admin');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Audit Logs</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <Table>
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
              {logs.map((log) => (
                <TableRow key={log.id} className={isHighRisk(log.action) ? 'bg-destructive/5' : ''}>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {log.organizations?.name || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{log.actor}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isHighRisk(log.action) && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-md truncate">
                    {JSON.stringify(log.meta)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
