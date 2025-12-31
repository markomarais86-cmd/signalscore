import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Sparkles, Zap, CheckCircle, XCircle, Loader2, Eye, CheckCircle2, Shield, Database, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useApolloCredits } from "@/hooks/use-apollo-credits";
import { useContactProvider, ContactProvider } from "@/hooks/use-contact-provider";
import { toast } from "sonner";
import { contactsLogger } from "@/lib/logger";

export interface ICPCriteria {
  industries?: string[];
  geographies?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
}

interface ApolloRedemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountDomains: string[];
  icpCriteria?: ICPCriteria;
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
  is_tam_mode?: boolean;
}

export function ApolloRedemptionDialog({
  open,
  onOpenChange,
  accountDomains,
  icpCriteria,
  campaignName,
  onRedemptionComplete
}: ApolloRedemptionDialogProps) {
  const { userProfile } = useAuth();
  const { creditsRemaining, dailyLimit, configured, apiAccessible } = useApolloCredits();
  const { providerStatus, activeProvider, checkProviders, previewContacts, redeemContacts } = useContactProvider();
  
  // Credit protection limits
  const MAX_SINGLE_REDEMPTION = 1000;
  const CREDIT_WARNING_THRESHOLD = 0.8;
  
  // Detect TAM mode - when domains contain marker or icpCriteria is provided
  const isTamMode = accountDomains.length === 1 && accountDomains[0] === '__apollo_tam__' && !!icpCriteria;
  
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
  const [acknowledgeHighUsage, setAcknowledgeHighUsage] = useState(false);
  const [usePdlFallback, setUsePdlFallback] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<ContactProvider>('apollo');

  const personas = [
    "Technical Decision Maker",
    "Business Decision Maker",
    "IT Decision Maker",
    "Technical Influencer",
    "Business Influencer"
  ];

  // Calculate effective limit
  const requestedLimit = parseInt(importLimit || "0");
  const effectiveLimit = Math.min(
    requestedLimit,
    MAX_SINGLE_REDEMPTION,
    apiAccessible && creditsRemaining !== null ? creditsRemaining : MAX_SINGLE_REDEMPTION
  );
  
  const creditUsagePercent = apiAccessible && creditsRemaining !== null && creditsRemaining > 0
    ? (effectiveLimit / creditsRemaining) * 100
    : 0;
  
  const isHighCreditUsage = creditUsagePercent >= (CREDIT_WARNING_THRESHOLD * 100);

  // Analyze and preview when dialog opens
  useEffect(() => {
    if (open && userProfile?.org_id) {
      if (isTamMode) {
        previewApolloByICP();
        analyzeDuplicatesForOrg();
      } else if (accountDomains.length > 0) {
        previewApolloContacts();
        analyzeDuplicates();
      }
    }
  }, [open, userProfile?.org_id, accountDomains, isTamMode]);

  // Re-preview when personas change
  useEffect(() => {
    if (open && !isPreviewing) {
      if (isTamMode) {
        previewApolloByICP();
      } else if (accountDomains.length > 0) {
        previewApolloContacts();
      }
    }
  }, [selectedPersonas]);

  // ICP-based Apollo search (TAM mode)
  const previewApolloByICP = async () => {
    if (!icpCriteria) return;
    
    setIsPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-apollo-by-icp', {
        body: {
          industries: icpCriteria.industries,
          geographies: icpCriteria.geographies,
          company_sizes: icpCriteria.company_sizes,
          revenue_ranges: icpCriteria.revenue_ranges,
          persona_filters: selectedPersonas
        }
      });

      if (error) throw error;
      
      if (data.success) {
        setApolloPreview({
          total_available: data.total_available,
          domains_searched: 0,
          sample_titles: data.sample_titles || [],
          message: data.message,
          is_tam_mode: true
        });
      }
    } catch (err: any) {
      contactsLogger.error('Error previewing Apollo by ICP:', err);
      toast.error('Failed to preview Apollo contacts');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Domain-based Apollo search (normal mode)
  const previewApolloContacts = async () => {
    if (accountDomains.length === 0 || accountDomains[0] === '__apollo_tam__') return;
    
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
          message: data.message,
          is_tam_mode: false
        });
      }
    } catch (err: any) {
      contactsLogger.error('Error previewing Apollo contacts:', err);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Full org duplicate analysis for TAM mode
  const analyzeDuplicatesForOrg = async () => {
    if (!userProfile?.org_id) return;
    
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-apollo-duplicates', {
        body: {
          org_id: userProfile.org_id,
          check_type: 'full_analysis'
        }
      });

      if (error) throw error;
      setDuplicateAnalysis(data.analysis);
    } catch (err: any) {
      contactsLogger.error('Error analyzing duplicates:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Domain-specific duplicate analysis
  const analyzeDuplicates = async () => {
    if (!userProfile?.org_id || accountDomains.length === 0) return;
    
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
      contactsLogger.error('Error analyzing duplicates:', err);
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

  const estimatedNewContacts = apolloPreview 
    ? Math.max(0, apolloPreview.total_available - (duplicateAnalysis?.total_duplicates || 0))
    : 0;

  const handleRedeem = async () => {
    if (!userProfile?.org_id) return;

    setIsRedeeming(true);
    setRedemptionProgress(10);

    try {
      setRedemptionProgress(30);
      
      // Try Apollo first, fallback to PDL if needed
      const useProvider = usePdlFallback ? 'pdl' : 'apollo';
      let success = false;
      let data: any = null;

      if (useProvider === 'apollo') {
        // Use Apollo
        const functionName = isTamMode ? 'redeem-apollo-by-icp' : 'redeem-apollo-contacts';
        const requestBody = isTamMode 
          ? {
              org_id: userProfile.org_id,
              icp_criteria: icpCriteria,
              persona_filters: selectedPersonas,
              max_contacts: effectiveLimit,
              campaign_name: campaignName
            }
          : {
              org_id: userProfile.org_id,
              account_domains: accountDomains,
              persona_filters: selectedPersonas,
              max_contacts: effectiveLimit,
              campaign_name: campaignName
            };
        
        const result = await supabase.functions.invoke(functionName, {
          body: requestBody
        });

        if (result.error) {
          contactsLogger.debug('Apollo failed, trying PDL fallback:', result.error);
          // Try PDL fallback
          const pdlResult = await supabase.functions.invoke('redeem-pdl-contacts', {
            body: {
              org_id: userProfile.org_id,
              domains: isTamMode ? undefined : accountDomains,
              icp_criteria: isTamMode ? icpCriteria : undefined,
              persona_filters: selectedPersonas,
              max_contacts: effectiveLimit,
              campaign_name: campaignName
            }
          });
          data = pdlResult.data;
          success = !pdlResult.error && pdlResult.data?.success;
          setCurrentProvider('pdl');
        } else {
          data = result.data;
          success = result.data?.success;
          setCurrentProvider('apollo');
        }
      } else {
        // Use PDL directly
        const result = await supabase.functions.invoke('redeem-pdl-contacts', {
          body: {
            org_id: userProfile.org_id,
            domains: isTamMode ? undefined : accountDomains,
            icp_criteria: isTamMode ? icpCriteria : undefined,
            persona_filters: selectedPersonas,
            max_contacts: effectiveLimit,
            campaign_name: campaignName
          }
        });
        data = result.data;
        success = !result.error && result.data?.success;
        setCurrentProvider('pdl');
      }

      setRedemptionProgress(90);

      if (success && data) {
        const providerName = data.provider === 'pdl' ? 'PDL' : 'Apollo';
        toast.success(
          `Redeemed ${data.contacts_redeemed} contacts via ${providerName}! (${data.contacts_skipped_duplicate} duplicates skipped)`
        );
        
        onRedemptionComplete?.({
          contactsRedeemed: data.contacts_redeemed,
          creditsUsed: data.credits_used || 0
        });
        
        setRedemptionProgress(100);
        setTimeout(() => onOpenChange(false), 1000);
      } else {
        throw new Error(data?.error || 'Redemption failed');
      }
    } catch (err: any) {
      contactsLogger.error('Redemption error:', err);
      toast.error(err.message || 'Failed to redeem contacts');
    } finally {
      setIsRedeeming(false);
      setRedemptionProgress(0);
    }
  };

  const canRedeem = (configured || usePdlFallback) && 
    ((apiAccessible && creditsRemaining !== null && creditsRemaining > 0) || (!apiAccessible && (acknowledgeUnknownCredits || usePdlFallback))) &&
    effectiveLimit > 0 && 
    (!isHighCreditUsage || acknowledgeHighUsage || usePdlFallback) &&
    selectedPersonas.length > 0 &&
    (isTamMode ? !!icpCriteria : accountDomains.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {usePdlFallback ? 'Import Contacts via PDL' : 'Redeem Apollo Contacts'}
            {isTamMode && (
              <Badge variant="secondary" className="ml-2">
                <Database className="h-3 w-3 mr-1" />
                TAM Mode
              </Badge>
            )}
            {usePdlFallback && (
              <Badge variant="outline" className="ml-2 bg-purple-500/10 text-purple-600 border-purple-500/50">
                PDL
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isTamMode 
              ? `Import contacts matching your ICP criteria from ${usePdlFallback ? 'People Data Labs' : 'Apollo'}'s database.`
              : `Import contacts for ${accountDomains.length.toLocaleString()} selected accounts via ${usePdlFallback ? 'PDL' : 'Apollo'}.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview Mode Indicator */}
          <Alert className="bg-blue-500/10 border-blue-500/50">
            <Eye className="h-4 w-4 text-blue-500" />
            <AlertDescription>
              <div className="font-medium text-blue-600 mb-1 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Preview Mode - No Contact Details Shown
              </div>
              <p className="text-sm text-muted-foreground">
                Only aggregate counts and job titles are displayed. Personal contact information (names, emails, phones) 
                will only be retrieved when you confirm the redemption.
              </p>
            </AlertDescription>
          </Alert>

          {/* Provider Status & PDL Fallback Option */}
          <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!apiAccessible && !usePdlFallback ? (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">
                  {usePdlFallback ? 'PDL (People Data Labs)' : 'Apollo'} {apiAccessible || usePdlFallback ? 'Connected' : 'Limited Access'}
                </span>
              </div>
              {apiAccessible && creditsRemaining !== null && !usePdlFallback && (
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

            {/* PDL Fallback Toggle - show when Apollo has issues */}
            {!apiAccessible && (
              <div className="flex items-center justify-between p-3 rounded-md bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-purple-700">Use PDL as alternative</p>
                    <p className="text-xs text-muted-foreground">Apollo API limited - PDL can provide similar contacts</p>
                  </div>
                </div>
                <Checkbox
                  id="use-pdl"
                  checked={usePdlFallback}
                  onCheckedChange={(checked) => setUsePdlFallback(checked === true)}
                />
              </div>
            )}

            {/* Preview Results */}
            {isPreviewing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isTamMode ? 'Searching Apollo by ICP criteria...' : 'Previewing available contacts...'}
              </div>
            ) : apolloPreview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {apolloPreview.total_available.toLocaleString()} contacts available
                  </span>
                  {!isTamMode && apolloPreview.domains_searched > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (at {apolloPreview.domains_searched} accounts)
                    </span>
                  )}
                  {isTamMode && (
                    <Badge variant="outline" className="text-xs">ICP-based search</Badge>
                  )}
                </div>
                
                {apolloPreview.sample_titles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Sample titles:</span>
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
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Deduplication Protection
              </h4>
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
              onChange={(e) => {
                const val = parseInt(e.target.value || "0");
                if (val > MAX_SINGLE_REDEMPTION) {
                  setImportLimit(String(MAX_SINGLE_REDEMPTION));
                } else {
                  setImportLimit(e.target.value);
                }
              }}
              placeholder="500"
              min="1"
              max={MAX_SINGLE_REDEMPTION}
            />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {apolloPreview 
                  ? `Will import up to ${Math.min(effectiveLimit, estimatedNewContacts).toLocaleString()} new contacts`
                  : `Will import up to ${effectiveLimit.toLocaleString()} contacts (duplicates skipped automatically)`
                }
              </p>
              {requestedLimit > MAX_SINGLE_REDEMPTION && (
                <p className="text-xs text-amber-600">
                  ⚠️ Limited to {MAX_SINGLE_REDEMPTION.toLocaleString()} contacts per redemption to protect credits
                </p>
              )}
              {apiAccessible && creditsRemaining !== null && requestedLimit > creditsRemaining && (
                <p className="text-xs text-amber-600">
                  ⚠️ Adjusted to {creditsRemaining.toLocaleString()} (your remaining credits)
                </p>
              )}
            </div>
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

          {/* High Credit Usage Warning */}
          {isHighCreditUsage && apiAccessible && creditsRemaining !== null && (
            <Alert variant="default" className="bg-red-500/10 border-red-500/50">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="space-y-2">
                <p className="font-medium text-red-600">
                  ⚠️ High Credit Usage Warning
                </p>
                <p className="text-sm">
                  This redemption will use {creditUsagePercent.toFixed(0)}% of your remaining credits 
                  ({effectiveLimit.toLocaleString()} of {creditsRemaining.toLocaleString()}).
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="acknowledge-high-usage"
                    checked={acknowledgeHighUsage}
                    onCheckedChange={(checked) => setAcknowledgeHighUsage(checked === true)}
                  />
                  <Label htmlFor="acknowledge-high-usage" className="text-sm cursor-pointer">
                    I understand and want to proceed with this redemption
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Credit Warning */}
          {apiAccessible && creditsRemaining !== null && creditsRemaining < parseInt(importLimit || "0") && !isHighCreditUsage && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have {creditsRemaining.toLocaleString()} credits remaining. 
                Import will be limited to available credits.
              </AlertDescription>
            </Alert>
          )}

          {/* Redemption Progress */}
          {isRedeeming && (
            <div className="space-y-2">
              <Progress value={redemptionProgress} />
              <p className="text-sm text-center text-muted-foreground">
                {redemptionProgress < 30 && "Preparing redemption..."}
                {redemptionProgress >= 30 && redemptionProgress < 90 && "Fetching contacts from Apollo..."}
                {redemptionProgress >= 90 && "Saving contacts..."}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={!canRedeem || isRedeeming}
              className="gap-2"
            >
              {isRedeeming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redeeming...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Redeem {effectiveLimit.toLocaleString()} Contacts
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
