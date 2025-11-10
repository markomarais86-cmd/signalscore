import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, TrendingUp, Users, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AvailableMarketCardProps {
  totalAccounts: number;
  totalContacts: number;
  provider: string;
  lastSyncedAt: string | null;
}

export function AvailableMarketCard({
  totalAccounts,
  totalContacts,
  provider,
  lastSyncedAt
}: AvailableMarketCardProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      notation: 'compact',
      maximumFractionDigits: 1 
    }).format(num);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Available Market (TAM)</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            {provider}
          </Badge>
        </div>
        <CardDescription>
          External data matching your ICP criteria - potential addressable market
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* TAM Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Available Accounts</p>
            <p className="text-3xl font-bold text-foreground">
              {formatNumber(totalAccounts)}
            </p>
            <p className="text-xs text-muted-foreground">
              Companies matching ICP
            </p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Available Contacts</p>
            <p className="text-3xl font-bold text-foreground">
              {formatNumber(totalContacts)}
            </p>
            <p className="text-xs text-muted-foreground">
              Decision makers at target accounts
            </p>
          </div>
        </div>

        {/* Sync Status */}
        {lastSyncedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <Calendar className="h-3 w-3" />
            <span>
              Last synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Note:</strong> This is external market intelligence from {provider}.
            These accounts are not in your database yet but represent your potential TAM.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
