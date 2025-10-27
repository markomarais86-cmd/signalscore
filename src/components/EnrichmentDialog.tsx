// Phase 5: Enrichment Workflow
// Dialog for enriching accounts from external databases

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Database, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EnrichmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAccounts: string[];
  onEnrichmentComplete: () => void;
}

export function EnrichmentDialog({
  open,
  onOpenChange,
  selectedAccounts,
  onEnrichmentComplete,
}: EnrichmentDialogProps) {
  const [provider, setProvider] = useState<string>('zoominfo');
  const [enriching, setEnriching] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const providers = [
    { key: 'zoominfo', name: 'ZoomInfo', available: true },
    { key: 'apollo', name: 'Apollo.io', available: true },
    { key: 'cognism', name: 'Cognism', available: false },
  ];

  const handleEnrich = async () => {
    if (!userProfile.org_id || selectedAccounts.length === 0) return;
    
    setEnriching(true);
    try {
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id: userProfile.org_id,
          provider,
          job_type: 'accounts',
          status: 'pending',
          total_records: selectedAccounts.length,
          created_by: userProfile.user_id,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      toast({
        title: "Enrichment started",
        description: `Processing ${selectedAccounts.length} accounts from ${provider}...`,
      });

      // Call edge function to process enrichment
      const { data: enrichmentResult, error: enrichmentError } = await supabase.functions.invoke('process-enrichment', {
        body: {
          org_id: userProfile.org_id,
          job_id: job.id,
          account_ids: selectedAccounts,
          provider,
        },
      });

      if (enrichmentError) {
        throw enrichmentError;
      }

      toast({
        title: "Enrichment complete",
        description: `Successfully enriched ${enrichmentResult.enriched} of ${selectedAccounts.length} accounts`,
      });
      
      onEnrichmentComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error starting enrichment:', error);
      toast({
        title: "Error",
        description: "Failed to start enrichment process",
        variant: "destructive",
      });
    } finally {
      setEnriching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrich from External Database</DialogTitle>
          <DialogDescription>
            Select a data provider to enrich {selectedAccounts.length} selected account(s) with additional information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will fetch company details, contacts, and firmographic data from the selected provider.
              Enriched data will be tagged with the source and timestamp.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label>Select Provider</Label>
            <RadioGroup value={provider} onValueChange={setProvider}>
              {providers.map((p) => (
                <div key={p.key} className="flex items-center space-x-3 space-y-0">
                  <RadioGroupItem value={p.key} id={p.key} disabled={!p.available} />
                  <Label
                    htmlFor={p.key}
                    className="flex items-center gap-2 font-normal cursor-pointer"
                  >
                    <Database className="h-4 w-4" />
                    {p.name}
                    {!p.available && (
                      <Badge variant="secondary" className="text-xs">
                        Not configured
                      </Badge>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">What will be enriched:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Company information (revenue, employees, industry)</li>
              <li>• Additional contacts and decision makers</li>
              <li>• Technology stack and intent signals</li>
              <li>• Firmographic and demographic data</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enriching}>
            Cancel
          </Button>
          <Button onClick={handleEnrich} disabled={enriching}>
            {enriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching...
              </>
            ) : (
              `Enrich ${selectedAccounts.length} Account${selectedAccounts.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
