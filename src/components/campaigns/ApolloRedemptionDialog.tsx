import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Sparkles, Zap, CheckCircle, XCircle, Loader2, Eye, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useApolloCredits } from "@/hooks/use-apollo-credits";
import { toast } from "sonner";

interface ApolloRedemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountDomains: string[];
  campaignName?: string;
  onRedemptionComplete?: (result: { contactsRedeemed: number; creditsUsed: number }) => void;
}

interface DuplicateAnalysis {
  existing_leads_count: number;
  crm_contacts_count: number;
  previous_exports_count: number;
  total_duplicates: number;
}

interface ApolloPreview {
  total_available: number;
  domains_searched: number;
  sample_titles: string[];
  message: string;
}

export function ApolloRedemptionDialog({
  open,
  onOpenChange,
  accountDomains,
  campaignName,
  onRedemptionComplete
}: ApolloRedemptionDialogProps) {
  const { userProfile } = useAuth();
  const { creditsRemaining, dailyLimit, configured, apiAccessible } = useApolloCredits();
  
  const [importLimit, setImportLimit] = useState("500");
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
    "Technical Decision Maker",
    "Business Decision Maker"
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [apolloPreview, setApolloPreview] = useState<ApolloPreview | null>(null);
  const [redemptionProgress, setRedemptionProgress] = useState(0);
  const [acknowledgeUnknownCredits, setAcknowledgeUnknownCredits] = useState(false);

  const personas = [
    "Technical Decision Maker",
    "Business Decision Maker",
    "IT Decision Maker",
    "Technical Influencer",
    "Business Influencer"
  ];

  // Analyze duplicates and preview when dialog opens
  useEffect(() => {
    if (open && userProfile?.org_id && accountDomains.length > 0) {
      analyzeDuplicates();
      previewApolloContacts();
    }
  }, [open, userProfile?.org_id, accountDomains]);

  // Re-preview when personas change
  useEffect(() => {
    if (open && accountDomains.length > 0 && !isPreviewing) {
      previewApolloContacts();
    }
  }, [selectedPersonas]);

  const previewApolloContacts = async () => {
    if (accountDomains.length === 0) return;
    
    setIsPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('preview-apollo-contacts', {
        body: {
          domains: accountDomains,
          persona_filters: selectedPersonas
        }
      });

      if (error) throw error;
      
      if (data.success) {
        setApolloPreview({
          total_available: data.total_available,
          domains_searched: data.domains_searched,
          sample_titles: data.sample_titles || [],
          message: data.message
        });
      }
    } catch (err: any) {
      console.error('Error previewing Apollo contacts:', err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const analyzeDuplicates = async () => {
    if (!userProfile?.org_id) return;
    
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-apollo-duplicates', {
        body: {
          org_id: userProfile.org_id,
          domains: accountDomains,
          check_type: 'full_analysis'
        }
      });

      if (error) throw error;
      setDuplicateAnalysis(data.analysis);
    } catch (err: any) {
      console.error('Error analyzing duplicates:', err);
      toast.error('Failed to analyze duplicates');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePersonaToggle = (persona: string) => {
    setSelectedPersonas(prev =>
      prev.includes(persona)
        ? prev.filter(p => p !== persona)
        : [...prev, persona]
    );
  };

  // Calculate estimated new contacts
  const estimatedNewContacts = apolloPreview 
    ? Math.max(0, apolloPreview.total_available - (duplicateAnalysis?.total_duplicates || 0))
    : 0;

  const handleRedeem = async () => {
    if (!userProfile?.org_id || accountDomains.length === 0) return;

    setIsRedeeming(true);
    setRedemptionProgress(10);

    try {
      setRedemptionProgress(30);
      
      const { data, error } = await supabase.functions.invoke('redeem-apollo-contacts', {
        body: {
          org_id: userProfile.org_id,
          account_domains: accountDomains,
          persona_filters: selectedPersonas,
          max_contacts: parseInt(importLimit || "500"),
          campaign_name: campaignName
        }
      });

      setRedemptionProgress(90);

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Redeemed ${data.contacts_redeemed} contacts! (${data.contacts_skipped_duplicate} duplicates skipped)`
        );
        
        onRedemptionComplete?.({
          contactsRedeemed: data.contacts_redeemed,
          creditsUsed: data.credits_used
        });
        
        setRedemptionProgress(100);
        setTimeout(() => onOpenChange(false), 1000);
      } else {
        throw new Error(data.error || 'Redemption failed');
      }
    } catch (err: any) {
      console.error('Redemption error:', err);
      toast.error(err.message || 'Failed to redeem contacts');
    } finally {
      setIsRedeeming(false);
      setRedemptionProgress(0);
    }
  };

  // Allow redemption when:
  // - Apollo is configured
  // - Either: credits are known and > 0, OR credits are unknown but user acknowledged
  // - Import limit is set
  // - At least one persona selected
  // - At least one account selected
  const canRedeem = configured && 
    ((apiAccessible && creditsRemaining !== null && creditsRemaining > 0) || (!apiAccessible && acknowledgeUnknownCredits)) &&
    parseInt(importLimit || "0") > 0 && 
    selectedPersonas.length > 0 &&
    accountDomains.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Redeem Apollo Contacts
          </DialogTitle>
          <DialogDescription>
            Import contacts from Apollo for {accountDomains.length.toLocaleString()} selected accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Apollo Status & Preview */}
          <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Apollo Connected</span>
              </div>
              {apiAccessible && creditsRemaining !== null && (
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">
                    {creditsRemaining.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    / {dailyLimit?.toLocaleString() ?? '—'} daily credits
                  </span>
                </div>
              )}
            </div>

            {/* Preview Results */}
            {isPreviewing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Previewing available contacts...
              </div>
            ) : apolloPreview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {apolloPreview.total_available.toLocaleString()} contacts available
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (at {apolloPreview.domains_searched} accounts)
                  </span>
                </div>
                
                {apolloPreview.sample_titles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {apolloPreview.sample_titles.map((title, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {title}
                      </Badge>
                    ))}
                  </div>
                )}

                {duplicateAnalysis && estimatedNewContacts > 0 && (
                  <div className="text-sm text-green-600 font-medium">
                    After removing {duplicateAnalysis.total_duplicates.toLocaleString()} duplicates: ~{estimatedNewContacts.toLocaleString()} new contacts
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Unknown credits warning */}
          {!apiAccessible && (
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/50">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="space-y-2">
                <p>Credit balance unavailable on your Apollo plan. Preview shows available contacts.</p>
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="acknowledge-credits"
                    checked={acknowledgeUnknownCredits}
                    onCheckedChange={(checked) => setAcknowledgeUnknownCredits(checked === true)}
                  />
                  <Label htmlFor="acknowledge-credits" className="text-sm cursor-pointer">
                    I understand credits will be consumed and want to proceed
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Duplicate Analysis */}
          {isAnalyzing ? (
            <div className="flex items-center justify-center py-4 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Analyzing duplicates...</span>
            </div>
          ) : duplicateAnalysis && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <h4 className="font-medium text-sm">Duplicate Analysis</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  {duplicateAnalysis.existing_leads_count > 0 ? (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span>{duplicateAnalysis.existing_leads_count.toLocaleString()} in your database</span>
                </div>
                <div className="flex items-center gap-2">
                  {duplicateAnalysis.crm_contacts_count > 0 ? (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span>{duplicateAnalysis.crm_contacts_count.toLocaleString()} in CRM</span>
                </div>
                <div className="flex items-center gap-2">
                  {duplicateAnalysis.previous_exports_count > 0 ? (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span>{duplicateAnalysis.previous_exports_count.toLocaleString()} exported (90 days)</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                These contacts will be automatically skipped to save credits.
              </p>
            </div>
          )}

          {/* Import Limit */}
          <div className="space-y-2">
            <Label htmlFor="import-limit">Maximum Contacts to Import</Label>
            <Input
              id="import-limit"
              type="number"
              value={importLimit}
              onChange={(e) => setImportLimit(e.target.value)}
              placeholder="500"
              min="1"
              max={apiAccessible ? (creditsRemaining || 10000) : 10000}
            />
            <p className="text-sm text-muted-foreground">
              {apolloPreview 
                ? `Will import up to ${Math.min(parseInt(importLimit || "0"), estimatedNewContacts).toLocaleString()} new contacts`
                : `Will import up to ${parseInt(importLimit || "0").toLocaleString()} contacts (duplicates skipped automatically)`
              }
            </p>
          </div>

          {/* Persona Filter */}
          <div className="space-y-3">
            <Label>Target Personas</Label>
            <div className="grid grid-cols-2 gap-3">
              {personas.map((persona) => (
                <div key={persona} className="flex items-center space-x-2">
                  <Checkbox
                    id={persona}
                    checked={selectedPersonas.includes(persona)}
                    onCheckedChange={() => handlePersonaToggle(persona)}
                  />
                  <Label
                    htmlFor={persona}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {persona}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Credit Warning */}
          {apiAccessible && creditsRemaining !== null && creditsRemaining < parseInt(importLimit || "0") && (
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/50">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription>
                You only have {creditsRemaining.toLocaleString()} credits remaining. 
                Import will be limited to available credits.
              </AlertDescription>
            </Alert>
          )}

          {/* Redemption Progress */}
          {isRedeeming && (
            <div className="space-y-2">
              <Progress value={redemptionProgress} />
              <p className="text-sm text-center text-muted-foreground">
                Redeeming contacts...
              </p>
            </div>
          )}

          {/* Info */}
          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Contacts will be added to your leads database with <strong>data_source='apollo'</strong>.
              Duplicates (existing leads, CRM contacts, previous exports) are automatically skipped.
            </AlertDescription>
          </Alert>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {accountDomains.length.toLocaleString()} accounts selected
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRedeeming}>
              Cancel
            </Button>
            <Button
              disabled={!canRedeem || isRedeeming}
              onClick={handleRedeem}
            >
              {isRedeeming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redeeming...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Redeem Contacts
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}