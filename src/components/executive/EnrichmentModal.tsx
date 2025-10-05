import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

  const providers: EnrichmentProvider[] = [
    {
      id: "pdl",
      name: "People Data Labs (Free Tier)",
      description: "Company firmographics and basic contact data",
      tier: "free",
      fields: ["Industry", "Company Size", "Location"]
    },
    {
      id: "clearbit",
      name: "Clearbit (Free Tier)",
      description: "Company enrichment and tech stack insights",
      tier: "free",
      fields: ["Revenue", "Industry", "Technologies"]
    },
    {
      id: "apollo",
      name: "Apollo.io",
      description: "Premium contact and company data",
      tier: "premium",
      fields: ["All Firmographics", "Contacts", "Technologies"]
    }
  ];

  const handleEnrich = async () => {
    if (selectedProviders.length === 0) {
      toast.error("Please select at least one provider");
      return;
    }

    if (!userProfile?.org_id) {
      toast.error("User profile not found");
      return;
    }

    setEnriching(true);
    try {
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          provider: selectedProviders.join(','),
          job_type: 'firmographic',
          status: 'pending',
          total_records: selectedAccounts || 0
        })
        .select()
        .single();

      if (jobError) throw jobError;

      toast.success("Enrichment started", {
        description: `Enriching ${selectedAccounts || 'all'} accounts with ${selectedProviders.length} provider(s)`
      });

      // Simulate enrichment progress (in production, this would be handled by an edge function)
      setTimeout(async () => {
        await supabase
          .from('enrichment_jobs')
          .update({ 
            status: 'completed',
            processed_records: selectedAccounts || 0,
            enriched_records: Math.floor((selectedAccounts || 0) * 0.85)
          })
          .eq('id', job.id);

        toast.success("Enrichment completed");
      }, 5000);

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error starting enrichment:', error);
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
            Select data providers to enrich your accounts with missing firmographic and contact information
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {selectedAccounts > 0 
              ? `Enriching ${selectedAccounts.toLocaleString()} selected accounts`
              : "Enriching all accounts with incomplete data"
            }
            {targetFields.length > 0 && ` - Focus: ${targetFields.join(', ')}`}
          </AlertDescription>
        </Alert>

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
