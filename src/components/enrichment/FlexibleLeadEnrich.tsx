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
  AlertCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedInput {
  type: 'email' | 'domain' | 'company';
  value: string;
  domain?: string;
}

interface EnrichmentResult {
  input: any;
  enriched_data: Record<string, any>;
  source: string;
  confidence: number;
  fields_filled: string[];
  api_calls_saved: boolean;
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
  const [expanded, setExpanded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [checkInternalFirst, setCheckInternalFirst] = useState(true);
  const [autoMatchAccounts, setAutoMatchAccounts] = useState(true);
  const [forceReEnrich, setForceReEnrich] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<EnrichmentResult[] | null>(null);
  const [parsedInputs, setParsedInputs] = useState<ParsedInput[]>([]);

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
    setResults(null);
  };

  // Process enrichment
  const handleEnrich = async () => {
    if (!userProfile?.org_id || parsedInputs.length === 0) return;

    setIsProcessing(true);
    setResults(null);

    try {
      // Convert parsed inputs to the format expected by the edge function
      const inputs = parsedInputs.map(p => ({
        email: p.type === 'email' ? p.value : undefined,
        domain: p.type === 'domain' ? p.value : p.domain,
        company_name: p.type === 'company' ? p.value : undefined,
        source_type: sourceType
      }));

      const { data, error } = await supabase.functions.invoke('enrich-v4', {
        body: {
          inputs,
          org_id: userProfile.org_id,
          source_type: sourceType,
          force_external: forceReEnrich,
          skip_ai: false
        }
      });

      if (error) throw error;

      setResults(data.results);

      const stats = data.stats;
      toast({
        title: "Enrichment Complete",
        description: `${stats.internal_matches} from internal data, ${stats.apollo_enriched + stats.pdl_enriched} from APIs, ${stats.ai_enriched} from AI. Saved ${stats.api_calls_saved} API calls.`,
      });

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

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'internal': return <Database className="h-3 w-3" />;
      case 'apollo': return <Zap className="h-3 w-3" />;
      case 'pdl': return <Users className="h-3 w-3" />;
      case 'ai': return <Sparkles className="h-3 w-3" />;
      default: return <Globe className="h-3 w-3" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'internal': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'apollo': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pdl': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'ai': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-muted text-muted-foreground';
    }
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
                    <Badge variant="secondary" className="text-xs">New</Badge>
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

            {/* Results */}
            {results && results.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Enrichment Results
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {results.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-lg border bg-muted/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">
                          {result.input.email || result.input.domain || result.input.company_name}
                        </span>
                        <div className="flex items-center gap-2">
                          {result.api_calls_saved && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Saved API call
                            </Badge>
                          )}
                          <Badge className={`text-xs ${getSourceColor(result.source)}`}>
                            {getSourceIcon(result.source)}
                            <span className="ml-1 capitalize">{result.source}</span>
                          </Badge>
                        </div>
                      </div>
                      {result.fields_filled.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.enriched_data.name && (
                            <Badge variant="secondary" className="text-xs">
                              {result.enriched_data.name}
                            </Badge>
                          )}
                          {result.enriched_data.employee_count && (
                            <Badge variant="secondary" className="text-xs">
                              {result.enriched_data.employee_count} employees
                            </Badge>
                          )}
                          {result.enriched_data.revenue_range && (
                            <Badge variant="secondary" className="text-xs">
                              {result.enriched_data.revenue_range}
                            </Badge>
                          )}
                          {result.enriched_data.industry_norm && (
                            <Badge variant="secondary" className="text-xs">
                              {result.enriched_data.industry_norm}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3" />
                          No data found
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Confidence: {Math.round(result.confidence * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
