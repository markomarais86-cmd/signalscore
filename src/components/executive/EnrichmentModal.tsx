import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { LaunchPulseMark } from '@/components/BrandLogo';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedEnrichment, EnrichmentConfig } from "@/hooks/use-unified-enrichment";

interface EnrichmentProvider {
  id: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  config: EnrichmentConfig;
}

interface EnrichmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAccounts?: number;
  targetFields?: string[];
}

const QUICK_PROVIDERS: EnrichmentProvider[] = [
  {
    id: "smart",
    name: "Smart Enrichment (Recommended)",
    description: "Perplexity → Firecrawl → AI → PDL → Apollo",
    tier: "free",
    config: {}
  },
  {
    id: "ai_free",
    name: "Free AI Enrichment ⭐",
    description: "AI-powered estimates, no API credits",
    tier: "free",
    config: { skipPaidProviders: true }
  }
];

export function EnrichmentModal({
  open,
  onOpenChange,
  selectedAccounts = 0,
  targetFields = []
}: EnrichmentModalProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState<string>("smart");
  const [batchSize, setBatchSize] = useState<number>(100);
  
  const { isEnriching, progress, enrichAccounts, reset } = useUnifiedEnrichment({
    onComplete: () => {
      onOpenChange(false);
      window.location.reload();
    },
    onError: (error) => {
      console.error('Enrichment error:', error);
    }
  });

  // Reset enrichment state when modal opens
  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const handleEnrich = async () => {
    if (!userProfile?.org_id) return;
    
    const provider = QUICK_PROVIDERS.find(p => p.id === selectedProvider);
    if (!provider) return;

    // Fetch accounts to enrich
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('external_id, name, domain, industry_norm, industry_raw, employee_count, revenue_range, country, state_province, city')
      .eq('org_id', userProfile.org_id)
      .or('employee_count.is.null,revenue_range.is.null,industry_norm.is.null')
      .not('domain', 'is', null)
      .limit(batchSize);

    if (error) {
      console.error('Error fetching accounts:', error);
      return;
    }

    if (!accounts || accounts.length === 0) {
      return;
    }

    await enrichAccounts(userProfile.org_id, accounts, provider.config);
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const goToFullEnrichment = () => {
    onOpenChange(false);
    navigate('/enrichment?mode=existing&type=accounts');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LaunchPulseMark className="h-5 w-5 text-primary" />
            Quick Enrich
          </DialogTitle>
          <DialogDescription>
            Enrich accounts with missing firmographic data
          </DialogDescription>
        </DialogHeader>

        {isEnriching && progress ? (
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{progress.processed} / {progress.total}</span>
            </div>
            <Progress value={getProgressPercentage()} />
            <div className="text-xs text-muted-foreground">
              {progress.enriched} enriched • {progress.failed} failed
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {QUICK_PROVIDERS.find(p => p.id === selectedProvider)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Batch Size</label>
              <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 accounts</SelectItem>
                  <SelectItem value="250">250 accounts</SelectItem>
                  <SelectItem value="500">500 accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Enriches up to {batchSize} accounts with incomplete data
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 pt-2">
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnriching}>
              Cancel
            </Button>
            <Button onClick={handleEnrich} disabled={isEnriching}>
              {isEnriching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <LaunchPulseMark className="h-4 w-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToFullEnrichment}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Full Enrichment Options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
