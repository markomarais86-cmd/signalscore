import { Database, Target, AlertCircle } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface AccountsHeaderProps {
  icpContext: {
    icpId?: string;
    icpName?: string;
  } | null;
  displayMode: 'realtime' | 'cached';
  setDisplayMode: (mode: 'realtime' | 'cached') => void;
  integrationConfigId: string | null;
  selectedAccountIds: Set<string>;
  hasActiveFilters: boolean;
  isLoading: boolean;
  totalCount: number;
  onOpenCampaignBuilder: () => void;
  onOpenEnrichmentModal: () => void;
  onRefresh: () => void;
}

export function AccountsHeader({
  icpContext,
  displayMode,
  setDisplayMode,
  integrationConfigId,
  selectedAccountIds,
  hasActiveFilters,
  isLoading,
  totalCount,
  onOpenCampaignBuilder,
  onOpenEnrichmentModal,
  onRefresh,
}: AccountsHeaderProps) {
  const { toast } = useToast();

  return (
    <>
      {/* Real-time mode indicator */}
      {displayMode === 'realtime' && (
        <Alert className="mb-4 border-primary/20 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground">
            <span className="font-semibold">🔴 Live from CRM</span>
            {' '}- Displaying real-time data from your CRM. ICP scores are enriched from local analysis.
            <Button
              size="sm"
              variant="ghost"
              className="ml-2 h-6 text-xs"
              onClick={() => {
                sessionStorage.clear();
                onRefresh();
                toast({
                  title: "Cache cleared",
                  description: "Fetching fresh data from CRM..."
                });
              }}
            >
              Clear Cache & Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold leading-tight">Accounts</h1>
          <p className="text-xs lg:text-sm text-muted-foreground mt-1">
            {icpContext ? 'Build targeted campaigns from high-fit accounts' : 'Complete account database view'}
          </p>
        </div>
        <div className="flex gap-2">
          {integrationConfigId && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg mr-2">
              <Label className="text-xs text-muted-foreground">Display:</Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={displayMode === 'cached' ? 'default' : 'ghost'}
                  onClick={() => setDisplayMode('cached')}
                  className="h-7 text-xs"
                >
                  <Database className="h-3 w-3 mr-1" />
                  Cached
                </Button>
                <Button
                  size="sm"
                  variant={displayMode === 'realtime' ? 'default' : 'ghost'}
                  onClick={() => setDisplayMode('realtime')}
                  className="h-7 text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse mr-1" />
                  Live CRM
                </Button>
              </div>
            </div>
          )}
          {selectedAccountIds.size > 0 && (
            <Badge variant="secondary" className="px-3 py-2 text-sm">
              {selectedAccountIds.size} selected
            </Badge>
          )}
          <Button 
            variant="default" 
            onClick={onOpenCampaignBuilder}
            className="bg-primary"
            disabled={isLoading || totalCount === 0}
          >
            <Target className="h-4 w-4 mr-2" />
            {selectedAccountIds.size > 0 
              ? `Build Campaign with Selected (${selectedAccountIds.size})` 
              : hasActiveFilters 
                ? "Build Campaign with Filters" 
                : "Build Campaign"
            }
          </Button>
          <Button 
            variant="outline" 
            onClick={onOpenEnrichmentModal}
          >
            <LaunchPulseMark className="h-4 w-4 mr-2" />
            Enrich Data
          </Button>
        </div>
      </div>
    </>
  );
}
