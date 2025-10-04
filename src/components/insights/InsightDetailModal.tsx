import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  Target, 
  BarChart3, 
  Users, 
  Download,
  ExternalLink,
  Building2
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Account {
  external_id: string;
  name: string;
  domain: string;
  industry_norm: string;
  country: string;
  employee_count: number;
  revenue_range: string;
}

interface InsightDetailModalProps {
  insight: {
    id: string;
    type: 'opportunity' | 'warning' | 'recommendation' | 'trend';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    confidence: number;
    relatedSegments: string[];
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InsightDetailModal({ insight, isOpen, onClose }: InsightDetailModalProps) {
  const { userProfile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (insight && isOpen && userProfile?.org_id) {
      loadAffectedAccounts();
    }
  }, [insight, isOpen, userProfile?.org_id]);

  const loadAffectedAccounts = async () => {
    if (!userProfile?.org_id || !insight) return;
    
    setLoading(true);
    try {
      // Load accounts based on insight type
      let query = supabase
        .from('accounts')
        .select('external_id, name, domain, industry_norm, country, employee_count, revenue_range')
        .eq('org_id', userProfile.org_id);

      // Filter based on related segments if available
      if (insight.relatedSegments.length > 0) {
        query = query.in('industry_norm', insight.relatedSegments);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading affected accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSegment = () => {
    if (accounts.length === 0) return;

    const csv = [
      ['Account Name', 'Domain', 'Industry', 'Country', 'Employees', 'Revenue'],
      ...accounts.map(acc => [
        acc.name,
        acc.domain,
        acc.industry_norm,
        acc.country,
        acc.employee_count?.toString() || '',
        acc.revenue_range
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insight-${insight?.id}-accounts.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!insight) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-[hsl(var(--primary))]" />
            {insight.title}
          </DialogTitle>
          <DialogDescription>{insight.description}</DialogDescription>
          
          <div className="flex items-center gap-2 pt-2">
            <Badge className="bg-[hsl(var(--primary))] text-white">
              {insight.type.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              {insight.confidence}% Confidence
            </Badge>
            <Badge variant="secondary">
              {insight.priority.toUpperCase()} Priority
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">
              Affected Accounts ({accounts.length})
            </TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Expected Impact</p>
                    <p className="text-base font-medium">{insight.impact}</p>
                  </div>
                  
                  {insight.relatedSegments.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Related Segments</p>
                      <div className="flex flex-wrap gap-2">
                        {insight.relatedSegments.map((segment, idx) => (
                          <Badge key={idx} variant="outline">
                            {segment}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />
                      <span className="font-medium">Confidence Score:</span>
                      <span>{insight.confidence}% based on CRM + enrichment data</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Showing {accounts.length} accounts matching this insight
              </div>
              <Button size="sm" variant="outline" onClick={handleExportSegment}>
                <Download className="h-4 w-4 mr-2" />
                Export List
              </Button>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Loading affected accounts...
                  </p>
                ) : accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No accounts found for this insight
                  </p>
                ) : (
                  accounts.map((account) => (
                    <Card key={account.external_id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <h4 className="font-medium text-sm">{account.name}</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {account.industry_norm}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {account.country}
                              </Badge>
                              {account.employee_count && (
                                <Badge variant="outline" className="text-xs">
                                  {account.employee_count} employees
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {account.domain && (
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recommended Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Create Campaign List from These Accounts
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={handleExportSegment}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Segment for Outreach
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Target className="h-4 w-4 mr-2" />
                  Update ICP Based on This Insight
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Run Deeper Analysis on Segment
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
