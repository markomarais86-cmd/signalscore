import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

interface ContactDiscoveryStats {
  highFitAccounts: number;
  accountsWithoutContacts: number;
  totalContactsFound: number;
}

export function ContactDiscovery() {
  const [stats, setStats] = useState<ContactDiscoveryStats>({
    highFitAccounts: 0,
    accountsWithoutContacts: 0,
    totalContactsFound: 0,
  });
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadStats();
  }, [userProfile.org_id]);

  const loadStats = async () => {
    if (!userProfile.org_id) return;
    setLoading(true);

    try {
      // Get high-fit accounts (score >= 70)
      const { count: highFitCount } = await supabase
        .from('scores')
        .select('account_external_id', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70);

      // Get accounts with leads
      const { data: accountsWithLeads } = await supabase
        .from('Leads')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id);

      const accountIdsWithLeads = new Set(
        (accountsWithLeads || []).map(c => c.account_external_id)
      );

      // Get high-fit accounts without contacts
      const { data: highFitAccounts } = await supabase
        .from('scores')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70);

      const accountsWithoutContacts = (highFitAccounts || [])
        .filter(a => !accountIdsWithLeads.has(a.account_external_id))
        .length;

      // Get total leads from enrichment
      const { count: enrichedLeadCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'database');

      setStats({
        highFitAccounts: highFitCount || 0,
        accountsWithoutContacts,
        totalContactsFound: enrichedLeadCount || 0,
      });
    } catch (error) {
      console.error('Error loading contact discovery stats:', error);
      toast({
        title: "Error",
        description: "Failed to load contact discovery statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startContactDiscovery = async () => {
    if (!userProfile.org_id) return;
    setEnriching(true);
    setProgress(0);
    setLastResult(null);

    try {
      toast({
        title: "Contact Discovery Started",
        description: "Finding contacts for high-fit accounts...",
      });

      // Start enrichment
      const { data, error } = await supabase.functions.invoke('enrich-contacts-bulk', {
        body: { 
          orgId: userProfile.org_id,
          batchSize: 50 // Process 50 accounts at a time
        }
      });

      if (error) throw error;

      setLastResult(data);
      await loadStats();

      toast({
        title: "✓ Contact Discovery Complete!",
        description: `Found contacts for ${data.enriched} accounts`,
      });
    } catch (error: any) {
      console.error('Contact discovery error:', error);
      toast({
        title: "Contact Discovery Failed",
        description: error.message || "Failed to discover contacts",
        variant: "destructive",
      });
    } finally {
      setEnriching(false);
      setProgress(0);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Contact Discovery</CardTitle>
              <CardDescription>
                Find decision-makers at high-fit accounts using enrichment APIs
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 p-4 bg-background rounded-lg border">
          <div>
            <p className="text-sm text-muted-foreground">High-Fit Accounts</p>
            <p className="text-2xl font-bold">{stats.highFitAccounts.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Without Contacts</p>
            <p className="text-2xl font-bold text-[hsl(var(--signal-medium))]">
              {stats.accountsWithoutContacts.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contacts Found</p>
            <p className="text-2xl font-bold text-[hsl(var(--signal-high))]">
              {stats.totalContactsFound.toLocaleString()}
            </p>
          </div>
        </div>

        {enriching && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Discovering contacts...</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {lastResult && !enriching && (
          <div className="p-4 bg-background rounded-lg border space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--signal-high))] mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Last Discovery Results</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Accounts Processed:</span>
                    <span className="ml-2 font-medium">{lastResult.total || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contacts Found:</span>
                    <span className="ml-2 font-medium">{lastResult.enriched || 0}</span>
                  </div>
                </div>
                {lastResult.note && (
                  <p className="text-xs text-muted-foreground mt-2">{lastResult.note}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Uses PDL, Clearbit, and AI to find key decision-makers at accounts without contact data.
          </p>
          <Button
            onClick={startContactDiscovery}
            disabled={enriching || stats.accountsWithoutContacts === 0}
            className="w-full"
            size="lg"
          >
            {enriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Discovering Contacts...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Discover Contacts for {stats.accountsWithoutContacts} Accounts
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
