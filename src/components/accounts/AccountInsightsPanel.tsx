import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  TrendingUp, 
  Target, 
  Mail, 
  Clock, 
  ChevronDown,
  ChevronRight,
  Zap,
  Users,
  Building2,
  RefreshCw,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { useDataOrgId } from "@/hooks/use-data-org";
import { toast } from "sonner";

export interface AccountInsightsData {
  engagement: {
    bestTime?: string;
    bestChannel?: string;
    keyMessaging?: string[];
    urgencySignals?: string[];
  };
  buyingSignals: Array<{
    signal: string;
    strength: 'high' | 'medium' | 'low';
    action: string;
  }>;
  similarAccounts: Array<{
    name: string;
    similarity: number;
    outcome: string;
    dealSize?: string;
    insight?: string;
  }>;
  recommendedActions: Array<{
    priority: number;
    action: string;
    persona: string;
    reason: string;
  }>;
  confidence: number;
}

interface AccountInsightsPanelProps {
  accountExternalId: string;
  accountScore?: number | null;
  insights: AccountInsightsData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  cached?: boolean;
}

export function AccountInsightsPanel({ 
  accountExternalId,
  accountScore,
  insights, 
  isLoading, 
  error,
  onRefresh,
  cached
}: AccountInsightsPanelProps) {
  const { dataOrgId } = useDataOrgId();
  const [techInsightsText, setTechInsightsText] = useState<string | null>(null);
  const [isTechLoading, setIsTechLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    techStack: true,
    engagement: true,
    signals: true,
    similar: false,
    actions: true
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Combined generate: triggers both personalized insights + tech enrichment
  const handleGenerateAll = () => {
    onRefresh();
    generateTechInsights();
  };

  const generateTechInsights = async () => {
    if (!dataOrgId) return;
    setIsTechLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-technology-insights', {
        body: { accountIds: [accountExternalId], orgId: dataOrgId }
      });
      if (error) throw error;
      if (data?.results?.[0]?.ai_insights) {
        setTechInsightsText(data.results[0].ai_insights);
      }
    } catch (err: any) {
      console.error('Tech insights error:', err);
    } finally {
      setIsTechLoading(false);
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'high': return 'bg-[hsl(var(--signal-high))] text-white';
      case 'medium': return 'bg-[hsl(var(--signal-medium))] text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  // Show prompt to generate insights for high-scoring accounts
  if (!insights && !isLoading && !error && accountScore && accountScore >= 70) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
          <h4 className="font-semibold mb-2">AI Insights Available</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Generate personalized engagement strategy, buying signals, and technology stack analysis
          </p>
          <Button onClick={handleGenerateAll}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate All Insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Low-scoring accounts don't get AI insights
  if (!insights && !isLoading && !error && (!accountScore || accountScore < 70)) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="font-semibold mb-2">Insights Not Available</h4>
          <p className="text-sm text-muted-foreground">
            AI insights are generated for accounts with ICP score ≥ 70
          </p>
          {accountScore && (
            <Badge variant="outline" className="mt-2">
              Current Score: {accountScore}
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LaunchPulseMark className="h-5 w-5 animate-pulse text-primary" />
            Generating Personalized Insights...
          </CardTitle>
          <CardDescription>Analyzing account data and similar closed-won deals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-6 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <h4 className="font-semibold mb-2">Failed to Generate Insights</h4>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LaunchPulseMark className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI-Powered Insights</span>
          {cached && (
            <Badge variant="outline" className="text-xs">Cached</Badge>
          )}
          {insights.confidence && (
            <Badge variant="secondary" className="text-xs">
              {Math.round(insights.confidence * 100)}% confidence
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleGenerateAll}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh All
        </Button>
      </div>

      {/* Technology Stack Section */}
      {(techInsightsText || isTechLoading) && (
        <Collapsible open={openSections.techStack} onOpenChange={() => toggleSection('techStack')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Technology Stack Analysis
                  </span>
                  {openSections.techStack ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {isTechLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{techInsightsText || ''}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Engagement Section */}
      <Collapsible open={openSections.engagement} onOpenChange={() => toggleSection('engagement')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Engagement Strategy
                </span>
                {openSections.engagement ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {insights.engagement.bestTime && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Best Time to Engage</h4>
                    <p className="text-sm text-muted-foreground mt-1">{insights.engagement.bestTime}</p>
                  </div>
                </div>
              )}
              
              {insights.engagement.bestChannel && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Recommended Channel</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insights.engagement.bestChannel}</p>
                    </div>
                  </div>
                </>
              )}

              {insights.engagement.keyMessaging && insights.engagement.keyMessaging.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-2">Key Messaging Angles</h4>
                      <ul className="space-y-1">
                        {insights.engagement.keyMessaging.map((msg, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{msg}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {insights.engagement.urgencySignals && insights.engagement.urgencySignals.length > 0 && (
                <>
                  <Separator />
                  <div className="bg-[hsl(var(--signal-medium))]/10 p-3 rounded-lg border border-[hsl(var(--signal-medium))]/20">
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-[hsl(var(--signal-medium))]" />
                      Time-Sensitive Opportunities
                    </h4>
                    <ul className="space-y-1">
                      {insights.engagement.urgencySignals.map((signal, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {signal}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Buying Signals Section */}
      {insights.buyingSignals.length > 0 && (
        <Collapsible open={openSections.signals} onOpenChange={() => toggleSection('signals')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Buying Signals
                    <Badge variant="secondary">{insights.buyingSignals.length}</Badge>
                  </span>
                  {openSections.signals ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {insights.buyingSignals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Badge className={`shrink-0 ${getStrengthColor(signal.strength)}`}>
                      {signal.strength}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{signal.signal}</p>
                      <p className="text-xs text-muted-foreground mt-1">→ {signal.action}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Similar Accounts Section */}
      {insights.similarAccounts.length > 0 && (
        <Collapsible open={openSections.similar} onOpenChange={() => toggleSection('similar')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Similar Closed-Won Accounts
                    <Badge variant="secondary">{insights.similarAccounts.length}</Badge>
                  </span>
                  {openSections.similar ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {insights.similarAccounts.map((account, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{account.name}</span>
                      <div className="flex items-center gap-2">
                        {account.dealSize && (
                          <Badge variant="outline">{account.dealSize}</Badge>
                        )}
                        <Badge className="bg-[hsl(var(--signal-high))]">
                          {Math.round(account.similarity * 100)}% match
                        </Badge>
                      </div>
                    </div>
                    {account.insight && (
                      <p className="text-xs text-muted-foreground">{account.insight}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Recommended Actions Section */}
      {insights.recommendedActions.length > 0 && (
        <Collapsible open={openSections.actions} onOpenChange={() => toggleSection('actions')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Recommended Actions
                  </span>
                  {openSections.actions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {insights.recommendedActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                      {action.priority}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{action.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{action.persona}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
