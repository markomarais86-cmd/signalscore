import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, ChevronDown, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

interface Candidate {
  id: string;
  account_external_id: string;
  company_data: any;
  confidence: number;
  match_reasoning: string;
  citations: any;
}

interface CandidateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CandidateSelector({ isOpen, onClose }: CandidateSelectorProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen, userProfile]);

  const loadCandidates = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deep_research_candidates')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .is('selected', null)
        .is('dismissed', null)
        .order('confidence', { ascending: false })
        .limit(20);

      if (error) throw error;

      setCandidates((data || []) as Candidate[]);
    } catch (error) {
      console.error('Error loading candidates:', error);
      toast({
        title: "Error",
        description: "Failed to load candidates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectCandidate = async (candidate: Candidate) => {
    if (!userProfile?.org_id) return;

    try {
      // Update account with deep research data
      const { error: accountError } = await supabase
        .from('accounts')
        .update({
          name: candidate.company_data.name,
          domain: candidate.company_data.domain,
          employee_count: candidate.company_data.employee_count,
          revenue_range: candidate.company_data.revenue,
          country: candidate.company_data.location,
          enriched_from: 'deep_research',
          enrichment_confidence: candidate.confidence,
          enrichment_citations: candidate.citations,
          enriched_at: new Date().toISOString()
        })
        .eq('org_id', userProfile.org_id)
        .eq('external_id', candidate.account_external_id);

      if (accountError) throw accountError;

      // Mark candidate as selected
      const { error: candidateError } = await supabase
        .from('deep_research_candidates')
        .update({ selected: true })
        .eq('id', candidate.id);

      if (candidateError) throw candidateError;

      toast({
        title: "Candidate Selected",
        description: `${candidate.company_data.name} has been added to your accounts`
      });

      // Refresh list
      loadCandidates();
    } catch (error) {
      console.error('Error selecting candidate:', error);
      toast({
        title: "Error",
        description: "Failed to select candidate",
        variant: "destructive"
      });
    }
  };

  const dismissCandidate = async (candidateId: string) => {
    try {
      const { error } = await supabase
        .from('deep_research_candidates')
        .update({ dismissed: true })
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: "Candidate Dismissed",
        description: "This match has been removed from the review queue"
      });

      // Refresh list
      loadCandidates();
    } catch (error) {
      console.error('Error dismissing candidate:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss candidate",
        variant: "destructive"
      });
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return <Badge className="bg-[hsl(var(--signal-high))]">High Confidence</Badge>;
    if (confidence >= 70) return <Badge className="bg-primary">Medium Confidence</Badge>;
    return <Badge variant="outline">Low Confidence</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Ambiguous Matches</DialogTitle>
          <DialogDescription>
            Deep research found multiple potential matches. Select the correct company or dismiss if none match.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading candidates...</div>
        ) : candidates.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-[hsl(var(--signal-high))] mb-3" />
            <p className="font-medium">All Clear!</p>
            <p className="text-sm text-muted-foreground mt-1">No ambiguous matches need review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {candidates.map((candidate) => (
              <Card key={candidate.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {candidate.company_data.name}
                        {candidate.company_data.domain && (
                          <a
                            href={`https://${candidate.company_data.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        {getConfidenceBadge(candidate.confidence * 100)}
                        {candidate.company_data.location && (
                          <Badge variant="outline">{candidate.company_data.location}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Employees:</span>
                      <p className="text-muted-foreground">
                        {candidate.company_data.employee_count?.toLocaleString() || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Revenue:</span>
                      <p className="text-muted-foreground">
                        {candidate.company_data.revenue || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Domain:</span>
                      <p className="text-muted-foreground">
                        {candidate.company_data.domain || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Match Reasoning:</p>
                    <p className="text-sm text-muted-foreground">{candidate.match_reasoning}</p>
                  </div>

                  {candidate.citations && candidate.citations.length > 0 && (
                    <Collapsible open={expandedId === candidate.id} onOpenChange={(open) => setExpandedId(open ? candidate.id : null)}>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === candidate.id ? 'rotate-180' : ''}`} />
                        View {candidate.citations.length} Sources
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 mt-2">
                        {candidate.citations.map((citation, idx) => (
                          <div key={idx} className="bg-background p-2 rounded border text-xs">
                            <a
                              href={citation.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium flex items-center gap-1"
                            >
                              {citation.url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <p className="text-muted-foreground mt-1">{citation.supporting_text}</p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={() => selectCandidate(candidate)} className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Select This Match
                    </Button>
                    <Button onClick={() => dismissCandidate(candidate.id)} variant="outline">
                      <XCircle className="h-4 w-4 mr-2" />
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
