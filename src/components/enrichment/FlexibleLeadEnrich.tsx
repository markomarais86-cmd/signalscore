import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
  Globe,
  Users,
  Calendar,
  Linkedin,
  Upload,
  CheckCircle,
  Loader2,
  Bot,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ParsedInput {
  type: 'email' | 'domain' | 'company';
  value: string;
  domain?: string;
}

interface EnrichmentSummary {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  remaining: number;
  totalCost: number;
  avgConfidence: number;
}

interface SourceBreakdown {
  [provider: string]: {
    attempted: number;
    enriched: number;
    cost: number;
  };
}

const SOURCE_OPTIONS = [
  { value: 'webinar', label: 'Webinar', icon: Calendar, description: 'Attendees from webinar registration' },
  { value: 'website_visitor', label: 'Website', icon: Globe, description: 'Visitors identified on your website' },
  { value: 'event_attendee', label: 'Event', icon: Users, description: 'Leads from conferences or events' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, description: 'Contacts from LinkedIn' },
  { value: 'csv_import', label: 'CSV Import', icon: Upload, description: 'Imported from spreadsheet' },
  { value: 'manual', label: 'Manual Entry', icon: Sparkles, description: 'Manually entered leads' },
];

export function FlexibleLeadEnrich() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [checkInternalFirst, setCheckInternalFirst] = useState(true);
  const [autoMatchAccounts, setAutoMatchAccounts] = useState(true);
  const [forceReEnrich, setForceReEnrich] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedInputs, setParsedInputs] = useState<ParsedInput[]>([]);
  const [enrichmentResult, setEnrichmentResult] = useState<{
    summary: EnrichmentSummary;
    source_breakdown: SourceBreakdown;
    job_id?: string;
  } | null>(null);

  // Parse input text into structured data
  const parseInputs = (text: string): ParsedInput[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed: ParsedInput[] = [];

    for (const line of lines) {
      // Check if it's an email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (line.includes('@') && emailRegex.test(line)) {
        const domain = line.split('@')[1];
        parsed.push({ type: 'email', value: line.toLowerCase(), domain });
      }
      // Check if it's a domain (contains dot, no spaces, no @)
      else if (line.includes('.') && !line.includes(' ') && !line.includes('@')) {
        const domainRegex = /^(https?:\/\/)?(www\.)?/;
        const cleanDomain = line.replace(domainRegex, '').split('/')[0];
        parsed.push({ type: 'domain', value: cleanDomain.toLowerCase() });
      }
      // Otherwise treat as company name
      else {
        parsed.push({ type: 'company', value: line });
      }
    }

    return parsed;
  };

  // Update parsed inputs when text changes
  const handleInputChange = (text: string) => {
    setInputText(text);
    setParsedInputs(parseInputs(text));
    setEnrichmentResult(null);
  };

  // Process enrichment using enrich-unified API
  const handleEnrich = async () => {
    if (!userProfile?.org_id || parsedInputs.length === 0) return;

    setIsProcessing(true);
    setEnrichmentResult(null);

    try {
      // Convert parsed inputs to enrich-unified format
      const records = parsedInputs.map((p, idx) => ({
        id: idx + 1,
        email: p.type === 'email' ? p.value : undefined,
        domain: p.type === 'domain' ? p.value : p.domain,
        company: p.type === 'company' ? p.value : undefined,
        name: p.type === 'company' ? p.value : undefined,
      }));

      const { data, error } = await supabase.functions.invoke('enrich-unified', {
        body: {
          org_id: userProfile.org_id,
          record_type: 'lead',
          records,
          config: {
            skipPaidProviders: !checkInternalFirst,
            verifyEmail: true,
            includeWebScrape: true,
          }
        }
      });

      if (error) throw error;

      // Handle async job response (for large batches)
      if (data?.job_id && !data?.summary) {
        toast({
          title: "Enrichment Started",
          description: `Processing ${parsedInputs.length} records in background. Check the Leads page for results.`,
        });
        setEnrichmentResult({ 
          summary: { total: parsedInputs.length, processed: 0, enriched: 0, failed: 0, remaining: parsedInputs.length, totalCost: 0, avgConfidence: 0 },
          source_breakdown: {},
          job_id: data.job_id 
        });
        return;
      }

      // Handle synchronous response with summary
      const summary = data?.summary || { total: parsedInputs.length, processed: 0, enriched: 0, failed: 0, remaining: 0, totalCost: 0, avgConfidence: 0 };
      const breakdown = data?.source_breakdown || {};

      setEnrichmentResult({ summary, source_breakdown: breakdown, job_id: data?.job_id });

      // Calculate totals from breakdown
      const internalCount = breakdown.internal_cache?.enriched || breakdown.internal?.enriched || 0;
      const apiCount = (breakdown.perplexity?.enriched || 0) + (breakdown.firecrawl?.enriched || 0) + 
                       (breakdown.apollo?.enriched || 0) + (breakdown.pdl?.enriched || 0);
      const aiCount = breakdown.ai?.enriched || breakdown.claude?.enriched || 0;

      toast({
        title: "Enrichment Complete",
        description: `${internalCount} from internal data, ${apiCount} from APIs, ${aiCount} from AI.`,
      });

      // Clear input after success
      setInputText("");
      setParsedInputs([]);

    } catch (error: any) {
      console.error('Enrichment error:', error);
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to enrich leads",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate display values from source breakdown
  const getBreakdownStats = () => {
    if (!enrichmentResult?.source_breakdown) return { internal: 0, api: 0, ai: 0 };
    const b = enrichmentResult.source_breakdown;
    return {
      internal: b.internal_cache?.enriched || b.internal?.enriched || 0,
      api: (b.perplexity?.enriched || 0) + (b.firecrawl?.enriched || 0) + 
           (b.apollo?.enriched || 0) + (b.pdl?.enriched || 0) + (b.hunter?.enriched || 0),
      ai: b.ai?.enriched || b.claude?.enriched || b.anthropic?.enriched || 0
    };
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Flexible Enrichment
                    <Badge variant="secondary" className="text-xs">Unified API</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Paste emails, domains, or company names - no CSV required
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Source Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Lead Source</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {SOURCE_OPTIONS.find(o => o.value === sourceType)?.description}
              </p>
            </div>

            {/* Input Area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Paste Emails, Domains, or Company Names</Label>
              <Textarea
                placeholder={`john@acme.com\nsalesforce.com\n"Stripe Inc"\nmicrosoft.com\njane@bigcorp.io`}
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
              />
              {parsedInputs.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">Detected:</span>
                  {parsedInputs.filter(p => p.type === 'email').length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {parsedInputs.filter(p => p.type === 'email').length} emails
                    </Badge>
                  )}
                  {parsedInputs.filter(p => p.type === 'domain').length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {parsedInputs.filter(p => p.type === 'domain').length} domains
                    </Badge>
                  )}
                  {parsedInputs.filter(p => p.type === 'company').length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {parsedInputs.filter(p => p.type === 'company').length} companies
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="check-internal"
                  checked={checkInternalFirst}
                  onCheckedChange={(c) => setCheckInternalFirst(c as boolean)}
                />
                <Label htmlFor="check-internal" className="text-sm cursor-pointer">
                  Check internal data first (saves API credits)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-match"
                  checked={autoMatchAccounts}
                  onCheckedChange={(c) => setAutoMatchAccounts(c as boolean)}
                />
                <Label htmlFor="auto-match" className="text-sm cursor-pointer">
                  Auto-match to existing accounts
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="force-reenrich"
                  checked={forceReEnrich}
                  onCheckedChange={(c) => setForceReEnrich(c as boolean)}
                />
                <Label htmlFor="force-reenrich" className="text-sm cursor-pointer text-muted-foreground">
                  Force re-enrich (ignore cached data)
                </Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleEnrich}
                disabled={parsedInputs.length === 0 || isProcessing}
                className="flex-1 gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Enrich {parsedInputs.length} Records
                  </>
                )}
              </Button>
            </div>

            {/* Results Summary - unified API returns aggregate stats */}
            {enrichmentResult && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {enrichmentResult.job_id && !enrichmentResult.summary.enriched 
                    ? 'Enrichment In Progress' 
                    : 'Enrichment Complete'}
                </h4>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Total:</span>{' '}
                    <span className="font-medium">{enrichmentResult.summary.total}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Enriched:</span>{' '}
                    <span className="font-medium text-green-600">{enrichmentResult.summary.enriched}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Database className="h-3 w-3 inline mr-1" />
                    <span className="text-muted-foreground">Internal:</span>{' '}
                    <span className="font-medium">{getBreakdownStats().internal}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Zap className="h-3 w-3 inline mr-1" />
                    <span className="text-muted-foreground">API:</span>{' '}
                    <span className="font-medium">{getBreakdownStats().api}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Bot className="h-3 w-3 inline mr-1" />
                    <span className="text-muted-foreground">AI:</span>{' '}
                    <span className="font-medium">{getBreakdownStats().ai}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Cost:</span>{' '}
                    <span className="font-medium">${enrichmentResult.summary.totalCost?.toFixed(4) || '0.00'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Enriched records have been saved to your leads.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => navigate('/leads')}
                  >
                    View Leads
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
