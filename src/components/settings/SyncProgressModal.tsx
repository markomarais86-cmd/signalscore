import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Building2, Users, Globe } from "lucide-react";
import { formatAbbreviated } from "@/utils/format-numbers";

interface SyncBreakdown {
  accounts: number;
  leads: number;
  geography?: Record<string, { percentage: number }>;
  industry?: Record<string, { percentage: number }>;
}

interface SyncProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  status: 'syncing' | 'complete' | 'error';
  progress?: number;
  processedRecords?: number;
  totalRecords?: number;
  breakdown?: SyncBreakdown;
  errorMessage?: string;
}

export function SyncProgressModal({
  open,
  onOpenChange,
  provider,
  status,
  progress = 0,
  processedRecords = 0,
  totalRecords = 0,
  breakdown,
  errorMessage
}: SyncProgressModalProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-6 w-6 text-executive-green" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-executive-red" />;
      default:
        return null;
    }
  };

  const getTopItems = (data?: Record<string, { percentage: number }>, limit = 3) => {
    if (!data) return [];
    return Object.entries(data)
      .sort((a, b) => b[1].percentage - a[1].percentage)
      .slice(0, limit);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {provider} Sync {status === 'complete' ? 'Complete' : status === 'error' ? 'Failed' : 'in Progress'}
          </DialogTitle>
          <DialogDescription>
            {status === 'syncing' && 'Fetching external data from TAM database...'}
            {status === 'complete' && 'Successfully synced external market data'}
            {status === 'error' && 'An error occurred during sync'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'syncing' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {totalRecords > 0 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Processing {formatAbbreviated(processedRecords)} of {formatAbbreviated(totalRecords)} records...
                  </p>
                </div>
              )}
            </>
          )}

          {status === 'complete' && breakdown && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>Accounts</span>
                  </div>
                  <div className="text-2xl font-bold">{formatAbbreviated(breakdown.accounts)}</div>
                </div>

                <div className="space-y-1 bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Leads</span>
                  </div>
                  <div className="text-2xl font-bold">{formatAbbreviated(breakdown.leads)}</div>
                </div>
              </div>

              {breakdown.geography && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Top Markets
                  </h4>
                  <div className="space-y-1">
                    {getTopItems(breakdown.geography).map(([country, data]) => (
                      <div key={country} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{country}</span>
                        <Badge variant="outline">{data.percentage}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {breakdown.industry && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Top Industries</h4>
                  <div className="space-y-1">
                    {getTopItems(breakdown.industry).map(([industry, data]) => (
                      <div key={industry} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[200px]">{industry}</span>
                        <Badge variant="outline">{data.percentage}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  ✓ Data successfully synced and ready for TAM analysis
                </p>
              </div>
            </>
          )}

          {status === 'error' && (
            <div className="rounded-lg border border-executive-red/30 bg-executive-red/5 p-4">
              <p className="text-sm text-executive-red font-medium mb-2">Sync Error</p>
              <p className="text-sm text-muted-foreground">
                {errorMessage || 'Failed to sync data. Please check your API credentials and try again.'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
