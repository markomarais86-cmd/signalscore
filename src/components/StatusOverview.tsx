import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, LucideIcon } from "lucide-react";

interface StatusItem {
  label: string;
  value: string | number;
  status: 'complete' | 'pending' | 'warning';
  icon?: LucideIcon;
}

interface StatusOverviewProps {
  items: StatusItem[];
  lastSync?: string;
}

export function StatusOverview({ items, lastSync }: StatusOverviewProps) {
  const getStatusIcon = (status: StatusItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--signal-high))]" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-[hsl(var(--signal-medium))]" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: StatusItem['status']) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-[hsl(var(--signal-high))] text-white text-xs">Complete</Badge>;
      case 'warning':
        return <Badge className="bg-[hsl(var(--signal-medium))] text-white text-xs">Needs Attention</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-xs">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Setup Status</h3>
          {lastSync && (
            <p className="text-xs text-muted-foreground">Last sync: {lastSync}</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {item.icon && <item.icon className="h-5 w-5 text-primary" />}
                {getStatusIcon(item.status)}
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xl font-bold mt-1">{item.value}</p>
                </div>
              </div>
              {getStatusBadge(item.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
