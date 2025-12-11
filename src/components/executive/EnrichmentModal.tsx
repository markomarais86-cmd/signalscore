import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Database, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrichmentProvider {
  id: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  fields: string[];
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
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [creditsAvailable, setCreditsAvailable] = useState<number | null>(null);
  const [batchSize, setBatchSize] = useState<number>(100);

  // Load available credits when modal opens
  useState(() => {
    if (open && userProfile?.org_id) {
      supabase
        .rpc('get_org_enrichment_credits', { org_uuid: userProfile.org_id })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setCreditsAvailable(data[0].remaining);
          }
        });
    }
  });

  const providers: EnrichmentProvider[] = [
    {
      id: "smart",
      name: "Smart Enrichment Waterfall (Recommended)",
      description: "Uses PDL → Clearbit → AI in sequence for best coverage",
      tier: "free",
      fields: ["Industry", "Company Size", "Revenue", "Location", "Employee Count"]
    },
    {
      id: "ai_free",
      name: "Free AI Enrichment ⭐",
      description: "AI-powered estimates using domain analysis. No API credits needed!",
      tier: "free",
      fields: ["Industry", "Employee Count", "Revenue Range", "Business Model"]
    },
    {
      id: "deep_research",
      name: "Deep Research (High-Value Accounts)",
      description: "AI-powered web research with citations, tech stack, funding, and confidence scores",
      tier: "premium",
      fields: ["All Fields", "Tech Stack", "Funding", "Trust Signals", "Verified Contacts", "Citations"]
    }
  ];

  const handleEnrich = async () => {
    if (selectedProviders.length === 0) {
      toast.error("Please select enrichment option");
      return;
    }

    if (!userProfile?.org_id) {
      toast.error("Organization not found. Please refresh the page.");
      return;
    }

    setEnriching(true);
    try {
      const isDeepResearch = selectedProviders.includes('deep_research');
      const isAIFree = selectedProviders.includes('ai_free');
      
      // Determine provider type
      const providerType = isDeepResearch ? 'deep-research' : isAIFree ? 'ai_free' : 'smart-waterfall';
      
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          provider: providerType,
          job_type: 'accounts',
          status: 'pending',
          total_records: selectedAccounts || batchSize
        })
        .select()
        .single();

      if (jobError) throw jobError;
      if (!job) throw new Error('No job data returned');

      if (isDeepResearch) {
        toast.info("Starting deep research enrichment...", {
          description: "AI-powered research with citations and confidence scores"
        });

        // Call deep-enrich-contact edge function
        const { data: accounts } = await supabase
          .from('accounts')
          .select('external_id, name, domain')
          .eq('org_id', userProfile.org_id)
          .or('employee_count.is.null,revenue_range.is.null')
          .not('domain', 'is', null)
          .limit(Math.min(batchSize, 50)); // Max 50 for deep research

        if (accounts && accounts.length > 0) {
          const { error } = await supabase.functions.invoke('deep-enrich-contact', {
            body: { accounts, orgId: userProfile.org_id }
          });

          if (error) throw error;
        }
      } else if (isAIFree) {
        toast.info("Starting Free AI Enrichment...", {
          description: "AI-powered estimates - no API credits needed!"
        });

        // Call enrich-ai-only edge function
        const { error } = await supabase.functions.invoke('enrich-ai-only', {
          body: { jobId: job.id, batchSize }
        });

        if (error) throw error;
      } else {
        toast.info("Starting enrichment...", {
          description: "Enrichment waterfall: PDL → Clearbit → AI"
        });

        // Call smart-enrich edge function
        const { error } = await supabase.functions.invoke('smart-enrich', {
          body: { jobId: job.id, batchSize }
        });

        if (error) throw error;
      }

      // Poll job status every 2 seconds with progress updates
      const pollInterval = setInterval(async () => {
        const { data: jobStatus } = await supabase
          .from('enrichment_jobs')
          .select('status, enriched_records, processed_records, total_records')
          .eq('id', job.id)
          .single();

        if (jobStatus) {
          const progress = jobStatus.processed_records > 0 
            ? Math.round((jobStatus.processed_records / jobStatus.total_records) * 100)
            : 0;
          
          if (jobStatus.status === 'processing') {
            toast.info(`Enriching... ${progress}%`, {
              description: `${jobStatus.enriched_records} of ${jobStatus.processed_records} accounts enriched`,
              duration: 1000
            });
          } else if (jobStatus.status === 'completed') {
            clearInterval(pollInterval);
            toast.success("Enrichment complete!", {
              description: `${jobStatus.enriched_records} of ${jobStatus.total_records} accounts enriched`
            });
            onOpenChange(false);
            window.location.reload(); // Refresh to show new data
          } else if (jobStatus.status === 'failed') {
            clearInterval(pollInterval);
            toast.error("Enrichment failed");
            onOpenChange(false);
          }
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 300000);
    } catch (error: any) {
      console.error('Enrichment error:', error);
      toast.error(error.message || 'Failed to start enrichment');
    } finally {
      setEnriching(false);
    }
  };

  const toggleProvider = (providerId: string) => {
    setSelectedProviders(prev =>
      prev.includes(providerId)
        ? prev.filter(p => p !== providerId)
        : [...prev, providerId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Batch Size</label>
          <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(Number(v))}>
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
                  Est. cost: ~{Math.ceil(Math.min(batchSize, selectedAccounts || batchSize) * (selectedProviders.includes('deep_research') ? 2.5 : 0.25))} credits
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {selectedProviders.includes('deep_research') && (
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
              className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleProvider(provider.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedProviders.includes(provider.id)}
                  onCheckedChange={() => toggleProvider(provider.id)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enriching}>
            Cancel
          </Button>
          <Button onClick={handleEnrich} disabled={enriching || selectedProviders.length === 0}>
            {enriching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></div>
                Enriching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Enrichment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
