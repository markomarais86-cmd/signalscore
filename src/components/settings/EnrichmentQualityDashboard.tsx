import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Database, TrendingUp, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface EnrichmentStats {
  provider: string;
  totalJobs: number;
  successRate: number;
  avgEnriched: number;
  totalEnriched: number;
}

interface RecentJob {
  id: string;
  provider: string;
  status: string;
  enriched: number;
  failed: number;
  completed_at: string;
}

export function EnrichmentQualityDashboard() {
  const [loading, setLoading] = useState(true);
  const [providerStats, setProviderStats] = useState<EnrichmentStats[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [fieldCoverage, setFieldCoverage] = useState({
    industry: 0,
    employee_count: 0,
    revenue_range: 0,
    country: 0
  });
  const [timeline, setTimeline] = useState<any[]>([]);
  
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadDashboardData();
    }
  }, [userProfile?.org_id]);

  const loadDashboardData = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      // Load enrichment jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('job_type', 'firmographic')
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Calculate provider stats
      const providers = ['clearbit_free', 'lovable_ai', 'pdl', 'smart_sequential'];
      const stats: EnrichmentStats[] = providers.map(provider => {
        const providerJobs = (jobs || []).filter(j => j.provider === provider && j.status === 'completed');
        const totalEnriched = providerJobs.reduce((sum, j) => sum + (j.enriched_records || 0), 0);
        const totalProcessed = providerJobs.reduce((sum, j) => sum + (j.processed_records || 0), 0);
        
        return {
          provider: provider === 'clearbit_free' ? 'Clearbit' : 
                   provider === 'lovable_ai' ? 'AI' : 
                   provider === 'smart_sequential' ? 'Smart' : 'PDL',
          totalJobs: providerJobs.length,
          successRate: totalProcessed > 0 ? Math.round((totalEnriched / totalProcessed) * 100) : 0,
          avgEnriched: providerJobs.length > 0 ? Math.round(totalEnriched / providerJobs.length) : 0,
          totalEnriched
        };
      }).filter(s => s.totalJobs > 0);

      setProviderStats(stats);

      // Recent jobs
      const recent = (jobs || [])
        .filter(j => j.status === 'completed')
        .slice(0, 10)
        .map(j => ({
          id: j.id,
          provider: j.provider === 'clearbit_free' ? 'Clearbit' : 
                   j.provider === 'lovable_ai' ? 'AI' : 
                   j.provider === 'smart_sequential' ? 'Smart' : 'PDL',
          status: j.status,
          enriched: j.enriched_records || 0,
          failed: j.failed_records || 0,
          completed_at: j.completed_at
        }));

      setRecentJobs(recent);

      // Field coverage
      const { data: accounts } = await supabase
        .from('accounts')
        .select('industry_norm, employee_count, revenue_range, country')
        .eq('org_id', userProfile.org_id);

      if (accounts && accounts.length > 0) {
        const total = accounts.length;
        setFieldCoverage({
          industry: Math.round((accounts.filter(a => a.industry_norm).length / total) * 100),
          employee_count: Math.round((accounts.filter(a => a.employee_count).length / total) * 100),
          revenue_range: Math.round((accounts.filter(a => a.revenue_range).length / total) * 100),
          country: Math.round((accounts.filter(a => a.country).length / total) * 100)
        });
      }

      // Timeline data (last 7 days)
      const { data: history } = await supabase
        .from('data_quality_history')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: true })
        .limit(7);

      if (history) {
        setTimeline(history.map(h => ({
          date: new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          completeness: Math.round(h.overall_completeness || 0)
        })));
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to load enrichment dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enrichment Quality Dashboard</CardTitle>
          <CardDescription>Track enrichment performance, costs, and data quality improvements</CardDescription>
        </CardHeader>
      </Card>

      {/* Provider Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Performance</CardTitle>
          <CardDescription>Success rates and volume by enrichment provider</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={providerStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="provider" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalEnriched" fill="hsl(var(--primary))" name="Total Enriched" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Field Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>Data Field Coverage</CardTitle>
          <CardDescription>Completeness of key firmographic fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Industry</span>
              <span className="text-sm text-muted-foreground">{fieldCoverage.industry}%</span>
            </div>
            <Progress value={fieldCoverage.industry} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Employee Count</span>
              <span className="text-sm text-muted-foreground">{fieldCoverage.employee_count}%</span>
            </div>
            <Progress value={fieldCoverage.employee_count} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Revenue Range</span>
              <span className="text-sm text-muted-foreground">{fieldCoverage.revenue_range}%</span>
            </div>
            <Progress value={fieldCoverage.revenue_range} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Country</span>
              <span className="text-sm text-muted-foreground">{fieldCoverage.country}%</span>
            </div>
            <Progress value={fieldCoverage.country} />
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Completeness Trend</CardTitle>
            <CardDescription>Overall data quality improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="completeness" stroke="hsl(var(--primary))" strokeWidth={2} name="Completeness %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Enrichment Jobs</CardTitle>
          <CardDescription>Last 10 completed enrichment operations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No enrichment jobs yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Enriched</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => {
                  const total = job.enriched + job.failed;
                  const successRate = total > 0 ? Math.round((job.enriched / total) * 100) : 0;
                  
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Badge variant="outline">{job.provider}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{job.enriched}</TableCell>
                      <TableCell className="text-muted-foreground">{job.failed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {successRate >= 80 ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          )}
                          <span>{successRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(job.completed_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cost Analysis (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Analysis</CardTitle>
          <CardDescription>Enrichment cost breakdown by provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {providerStats.map(stat => (
              <div key={stat.provider} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{stat.provider}</p>
                  <p className="text-sm text-muted-foreground">{stat.totalEnriched} accounts enriched</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {stat.provider === 'Clearbit' ? 'Free' : 
                     stat.provider === 'AI' ? `~$${(stat.totalEnriched * 0.001).toFixed(2)}` :
                     stat.provider === 'PDL' ? `~$${(stat.totalEnriched * 0.01).toFixed(2)}` :
                     'Variable'}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.successRate}% success</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
