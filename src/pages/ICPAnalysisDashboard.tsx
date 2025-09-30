import { useState, useEffect } from "react";
import { CRMAnalysis } from "@/components/CRMAnalysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Upload, Target, BarChart3, ArrowRight, Database } from "lucide-react";
import { StatusOverview } from "@/components/StatusOverview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export default function ICPAnalysisDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ accounts: 0, icps: 0, dataCompleteness: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadStats();
    }
  }, [userProfile?.org_id]);

  const loadStats = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const [accountsRes, icpsRes] = await Promise.all([
        supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', userProfile.org_id),
        supabase.from('icp_profiles').select('*', { count: 'exact', head: true }).eq('org_id', userProfile.org_id)
      ]);

      const accountCount = accountsRes.count || 0;
      const icpCount = icpsRes.count || 0;

      // Calculate data completeness
      const { data: accounts } = await supabase
        .from('accounts')
        .select('industry_raw, employee_count, revenue_range, country')
        .eq('org_id', userProfile.org_id);

      let completeness = 0;
      if (accounts && accounts.length > 0) {
        const totalFields = accounts.length * 4;
        const filledFields = accounts.reduce((sum, acc) => {
          return sum + 
            (acc.industry_raw ? 1 : 0) + 
            (acc.employee_count ? 1 : 0) + 
            (acc.revenue_range ? 1 : 0) + 
            (acc.country ? 1 : 0);
        }, 0);
        completeness = Math.round((filledFields / totalFields) * 100);
      }

      setStats({ accounts: accountCount, icps: icpCount, dataCompleteness: completeness });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusItems = [
    {
      label: 'CRM Data',
      value: stats.accounts,
      status: (stats.accounts > 0 ? 'complete' : 'pending') as 'complete' | 'pending' | 'warning',
      icon: Database
    },
    {
      label: 'ICPs Defined',
      value: stats.icps,
      status: (stats.icps > 0 ? 'complete' : 'warning') as 'complete' | 'pending' | 'warning',
      icon: Target
    },
    {
      label: 'Data Quality',
      value: `${stats.dataCompleteness}%`,
      status: (stats.dataCompleteness >= 70 ? 'complete' : stats.dataCompleteness >= 40 ? 'warning' : 'pending') as 'complete' | 'pending' | 'warning',
      icon: BarChart3
    }
  ];

  const getNextStep = () => {
    if (stats.accounts === 0) return { label: 'Upload CRM Data', path: '/data-upload' };
    if (stats.icps === 0) return { label: 'Create Your First ICP', path: '/icp-manager' };
    if (stats.dataCompleteness < 70) return { label: 'Improve Data Quality', path: '/data-upload' };
    return null;
  };

  const nextStep = getNextStep();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ICP Analysis Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Analyze how well your CRM data matches your Ideal Customer Profiles
          </p>
        </div>
      </div>

      {/* Status Overview */}
      {!loading && <StatusOverview items={statusItems} lastSync={new Date().toLocaleDateString()} />}

      {/* Next Step Guidance */}
      {nextStep && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Next Step</h3>
                <p className="text-sm text-muted-foreground">
                  Complete setup to unlock full ICP intelligence
                </p>
              </div>
              <Button onClick={() => navigate(nextStep.path)} className="gap-2">
                {nextStep.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300" onClick={() => navigate('/data-upload')}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                Upload CRM Data
              </CardTitle>
              {stats.accounts > 0 && (
                <Badge variant="secondary">{stats.accounts}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Import your accounts and contacts data via CSV files
            </p>
            <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              Go to Upload <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300" onClick={() => navigate('/icp-manager')}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                Manage ICPs
              </CardTitle>
              {stats.icps > 0 && (
                <Badge variant="secondary">{stats.icps}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Define and refine your Ideal Customer Profile criteria
            </p>
            <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              Manage ICPs <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300" onClick={() => navigate('/icp-tam')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              TAM Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              View detailed TAM analysis and board-ready reports
            </p>
            <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              View Reports <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis */}
      <CRMAnalysis />
    </div>
  );
}