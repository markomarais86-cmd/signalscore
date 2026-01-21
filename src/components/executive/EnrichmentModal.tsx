import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, AlertCircle, Loader2 } from "lucide-react";
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
  fields: string[];
  config: EnrichmentConfig;
}

interface EnrichmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAccounts?: number;
  targetFields?: string[];
}

export function EnrichmentModal({
  open,
  onOpenChange,
  selectedAccounts = 0,
  targetFields = []
}: EnrichmentModalProps) {
  const { userProfile } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState<string>("smart");
  const [creditsAvailable, setCreditsAvailable] = useState<number | null>(null);
  const [batchSize, setBatchSize] = useState<number>(100);
  
  const { isEnriching, progress, enrichAccounts, reset } = useUnifiedEnrichment({
    onComplete: (result) => {
      onOpenChange(false);
      window.location.reload();
    },
    onError: (error) => {
      console.error('Enrichment error:', error);
    }
  });

  // Load available credits when modal opens
  useEffect(() => {
    if (open && userProfile?.org_id) {
      supabase
        .rpc('get_org_enrichment_credits', { org_uuid: userProfile.org_id })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setCreditsAvailable(data[0].remaining);
          }
        });
    }
    
    // Reset enrichment state when modal opens
    if (open) {
      reset();
    }
  }, [open, userProfile?.org_id, reset]);

  const providers: EnrichmentProvider[] = [
    {
      id: "smart",
      name: "Smart Enrichment Waterfall (Recommended)",
      description: "Uses Perplexity → Firecrawl → AI → PDL → Apollo for best coverage",
      tier: "free",
      fields: ["Industry", "Company Size", "Revenue", "Location", "Employee Count"],
      config: {}
    },
    {
      id: "launch_pulse",
      name: "LaunchPulse Enrichment",
      description: "LaunchPulse proprietary data enrichment - high accuracy company data",
      tier: "free",
      fields: ["Industry", "Employee Count", "Revenue", "Location", "Tech Stack"],
      config: { includeWebScrape: true }
    },
    {
      id: "ai_free",
      name: "Free AI Enrichment ⭐",
      description: "AI-powered estimates using domain analysis. No API credits needed!",
      tier: "free",
      fields: ["Industry", "Employee Count", "Revenue Range", "Business Model"],
      config: { skipPaidProviders: true }
    },
    {
      id: "deep_research",
      name: "Deep Research (High-Value Accounts)",
      description: "AI-powered web research with citations, tech stack, funding, and confidence scores",
      tier: "premium",
      fields: ["All Fields", "Tech Stack", "Funding", "Trust Signals", "Verified Contacts", "Citations"],
      config: { includeWebScrape: true, verifyEmail: true }
    }
  ];

  const handleEnrich = async () => {
    if (!userProfile?.org_id) return;
    
    const provider = providers.find(p => p.id === selectedProvider);
    if (!provider) return;

    // Fetch accounts to enrich
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('external_id, name, domain, industry_norm, industry_raw, employee_count, revenue_range, country, state_province, city')
      .eq('org_id', userProfile.org_id)
      .or('employee_count.is.null,revenue_range.is.null,industry_norm.is.null')
      .not('domain', 'is', null)
      .limit(selectedProvider === 'deep_research' ? Math.min(batchSize, 50) : batchSize);

    if (error) {
      console.error('Error fetching accounts:', error);
      return;
    }

    if (!accounts || accounts.length === 0) {
      return;
    }

    // Use the unified enrichment hook
    await enrichAccounts(userProfile.org_id, accounts, provider.config);
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LaunchPulseMark className="h-5 w-5 text-primary" />
            Enrich Account Data
          </DialogTitle>
          <DialogDescription>
            Select data providers to enrich your accounts with missing firmographic data (industry, size, revenue, location)
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {selectedAccounts > 0 
              ? `Enriching up to ${Math.min(batchSize, selectedAccounts).toLocaleString()} accounts`
              : `Enriching up to ${batchSize.toLocaleString()} accounts with incomplete data`
            }
            {targetFields.length > 0 && ` - Focus: ${targetFields.join(', ')}`}
          </AlertDescription>
        </Alert>

        {isEnriching && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{progress.processed} / {progress.total}</span>
            </div>
            <Progress value={getProgressPercentage()} />
            <div className="text-xs text-muted-foreground">
              {progress.enriched} enriched • {progress.failed} failed • Est. cost: ${progress.totalCost.toFixed(2)}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Batch Size</label>
          <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(Number(v))} disabled={isEnriching}>
            <SelectTrigger>
              <SelectValue placeholder="Select batch size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 accounts (~15 sec)</SelectItem>
              <SelectItem value="250">250 accounts (~30 sec)</SelectItem>
              <SelectItem value="500">500 accounts (~1 min)</SelectItem>
              <SelectItem value="1000">1,000 accounts (~2 min)</SelectItem>
              <SelectItem value="2500">2,500 accounts (~5 min)</SelectItem>
              <SelectItem value="5000">5,000 accounts (~10 min)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            ⚡ Parallel processing: 15 concurrent API calls + AI batch size 50
          </p>
        </div>

        {creditsAvailable !== null && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {creditsAvailable.toLocaleString()} enrichment credits available
              </span>
              {batchSize > 0 && (
                <span className="text-xs text-muted-foreground">
                  Est. cost: ~{Math.ceil(Math.min(batchSize, selectedAccounts || batchSize) * (selectedProvider === 'deep_research' ? 2.5 : 0.25))} credits
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {selectedProvider === 'deep_research' && (
          <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-900 dark:text-yellow-100">
              ⚠️ Deep Research: ~10x cost vs standard enrichment (~${(Math.min(batchSize, selectedAccounts || batchSize) * 0.10).toFixed(2)})
              <br />
              <span className="text-xs">Provides: Tech stack, funding data, trust signals, verified contacts with citations</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedProvider === provider.id 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              } ${isEnriching ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => !isEnriching && setSelectedProvider(provider.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedProvider === provider.id}
                  onCheckedChange={() => !isEnriching && setSelectedProvider(provider.id)}
                  disabled={isEnriching}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{provider.name}</span>
                    <Badge variant={provider.tier === "free" ? "outline" : "default"}>
                      {provider.tier === "free" ? "Free" : "Premium"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {provider.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {provider.fields.map(field => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnriching}>
            Cancel
          </Button>
          <Button onClick={handleEnrich} disabled={isEnriching || !selectedProvider}>
            {isEnriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <LaunchPulseMark className="h-4 w-4 mr-2" />
                Start Enrichment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
