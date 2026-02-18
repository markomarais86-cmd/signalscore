import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Target, Building2, Users, MapPin, Cpu, ArrowRight, Plus, AlertCircle, TrendingUp, Briefcase, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { computeEnhancedICPConfidence, type ICPConfidenceResult, type ScoringStats } from "@/utils/icp-confidence";
import { supabase } from "@/integrations/supabase/client";

interface ICPProfileSummaryCardProps {
  icpProfiles: any[];
  className?: string;
}

function useICPScoringStats(icpId: string | undefined) {
  const [stats, setStats] = useState<ScoringStats>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icpId) return;
    setLoading(true);

    supabase
      .from('scores')
      .select('fit, computed_at')
      .eq('icp_id', icpId)
      .then(({ data, error }) => {
        if (error || !data) {
          setLoading(false);
          return;
        }
        const scoredAccounts = data.length;
        const avgFit = scoredAccounts > 0
          ? data.reduce((sum, s) => sum + (s.fit ?? 0), 0) / scoredAccounts
          : null;
        const lastScoredAt = scoredAccounts > 0
          ? data.reduce((latest, s) => (!latest || (s.computed_at && s.computed_at > latest) ? s.computed_at : latest), null as string | null)
          : null;

        setStats({ scoredAccounts, avgFit, lastScoredAt });
        setLoading(false);
      });
  }, [icpId]);

  return { stats, loading };
}

function ConfidenceBreakdownTooltip({ result }: { result: ICPConfidenceResult }) {
  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-blue-500';
    if (score >= 25) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-2.5 min-w-[200px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Confidence Breakdown</span>
        <span className="text-xs font-bold">{result.total}%</span>
      </div>
      {result.breakdown.map((b) => (
        <div key={b.label} className="space-y-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{b.label} ({Math.round(b.weight * 100)}%)</span>
            <span className="font-medium">{b.score}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/40">
            <div
              className={cn("h-full rounded-full transition-all", getBarColor(b.score))}
              style={{ width: `${b.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EnhancedConfidenceMeter({ result }: { result: ICPConfidenceResult }) {
  const confidence = result.total;

  const getColorClasses = () => {
    if (confidence >= 90) return { bg: 'bg-green-500', text: 'text-green-600' };
    if (confidence >= 70) return { bg: 'bg-blue-500', text: 'text-blue-600' };
    if (confidence >= 50) return { bg: 'bg-yellow-500', text: 'text-yellow-600' };
    return { bg: 'bg-orange-500', text: 'text-orange-600' };
  };

  const getLabel = () => {
    if (confidence >= 90) return 'Excellent';
    if (confidence >= 70) return 'Good';
    if (confidence >= 50) return 'Fair';
    return 'Low';
  };

  const colors = getColorClasses();
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative flex items-center justify-center w-12 h-12 cursor-help">
            <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
              <circle
                cx="25" cy="25" r={radius} fill="none" stroke="currentColor" strokeWidth={4}
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                className={colors.bg.replace('bg-', 'text-')}
                style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              />
            </svg>
            <div className="flex flex-col items-center justify-center z-10">
              <span className={cn('font-bold text-xs', colors.text)}>{confidence}%</span>
              <span className="font-medium text-[10px] text-muted-foreground">{getLabel()}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="p-3">
          <ConfidenceBreakdownTooltip result={result} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ICPProfileSummaryCard({ icpProfiles, className }: ICPProfileSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const profile = icpProfiles.find((p: any) => p.is_primary)
    || icpProfiles.find((p: any) => p.status === 'active')
    || icpProfiles[0];

  const { stats } = useICPScoringStats(profile?.id);

  if (!profile) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="rounded-full bg-primary/10 p-3 mb-3">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No ICP Defined</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Define your Ideal Customer Profile to start scoring and prioritizing accounts.
          </p>
          <Button onClick={() => navigate('/icp-manager')} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create ICP
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Correct field mappings to match database columns
  const industries = profile.industries || [];
  const companySizes = profile.company_sizes || [];
  const revenueRanges = profile.revenue_ranges || [];
  const geographies = profile.geographies || [];
  const jobTitles = profile.persona_job_titles || [];
  const seniorityLevels = profile.persona_seniority_levels || [];
  const departments = profile.persona_departments || [];
  const techStack = profile.tech_stack || [];
  const painPoints = profile.pain_points || [];
  const buyingSignals = profile.buying_signals || [];
  const companyStages = profile.company_stages || [];

  const confidenceResult = computeEnhancedICPConfidence(profile, {
    matchCount: profile.match_count ?? 0,
    tamEstimate: profile.tam_estimate ?? 0,
    ...stats,
  });

  const statusColor = profile.status === 'active'
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
    : profile.status === 'draft'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20'
      : 'bg-muted text-muted-foreground';

  const renderTags = (items: string[], max = 5) => {
    const visible = items.slice(0, max);
    const remaining = items.length - max;
    return (
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => (
          <Badge key={item} variant="secondary" className="text-xs font-normal">
            {item}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            +{remaining} more
          </Badge>
        )}
      </div>
    );
  };

  const Section = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {children}
    </div>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  {profile.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{profile.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EnhancedConfidenceMeter result={confidenceResult} />
                <Badge className={cn("text-xs capitalize", statusColor)}>
                  {profile.status || 'active'}
                </Badge>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate('/icp-manager'); }} className="text-xs">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Industries + Company Profile */}
              <div className="space-y-4">
                {industries.length > 0 && (
                  <Section icon={Building2} label="Industries">
                    {renderTags(industries, 6)}
                  </Section>
                )}
                {(companySizes.length > 0 || revenueRanges.length > 0) && (
                  <Section icon={Briefcase} label="Company Profile">
                    <div className="space-y-1.5">
                      {companySizes.length > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Size: </span>
                          {companySizes.join(', ')}
                        </p>
                      )}
                      {revenueRanges.length > 0 && renderTags(revenueRanges, 4)}
                      {companyStages.length > 0 && renderTags(companyStages, 3)}
                    </div>
                  </Section>
                )}
              </div>

              {/* Column 2: Geographies + Tech Stack */}
              <div className="space-y-4">
                {geographies.length > 0 && (
                  <Section icon={MapPin} label="Geographies">
                    {renderTags(geographies, 6)}
                  </Section>
                )}
                {techStack.length > 0 && (
                  <Section icon={Cpu} label="Tech Stack">
                    {renderTags(techStack, 5)}
                  </Section>
                )}
                {buyingSignals.length > 0 && (
                  <Section icon={TrendingUp} label="Buying Signals">
                    {renderTags(buyingSignals, 4)}
                  </Section>
                )}
              </div>

              {/* Column 3: Personas + Pain Points */}
              <div className="space-y-4">
                {(jobTitles.length > 0 || seniorityLevels.length > 0 || departments.length > 0) && (
                  <Section icon={Users} label="Personas">
                    <div className="space-y-1.5">
                      {seniorityLevels.length > 0 && renderTags(seniorityLevels, 4)}
                      {departments.length > 0 && renderTags(departments, 4)}
                      {jobTitles.length > 0 && renderTags(jobTitles, 5)}
                    </div>
                  </Section>
                )}
                {painPoints.length > 0 && (
                  <Section icon={AlertCircle} label="Pain Points">
                    {renderTags(painPoints, 4)}
                  </Section>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
