import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Target, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const chartConfig = {
  leads: {
    label: "Total Leads",
    color: "hsl(var(--chart-1))",
  },
  qualified: {
    label: "Qualified Leads",
    color: "hsl(var(--chart-2))",
  },
  accounts: {
    label: "Accounts",
    color: "hsl(var(--chart-3))",
  }
};

const SCORE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Dashboard() {
  const [timeFilter, setTimeFilter] = useState("30");
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0,
    salesVelocity: 0
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!userProfile?.org_id) return;
    
    loadDashboardData();
  }, [userProfile?.org_id, timeFilter]);

  const loadDashboardData = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Get basic stats
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, external_id')
        .eq('org_id', userProfile.org_id);

      const { data: scores } = await supabase
        .from('scores')
        .select('overall, account_external_id')
        .eq('org_id', userProfile.org_id);

      const totalLeads = accounts?.length || 0;
      const qualifiedLeads = scores?.filter(s => s.overall >= 70).length || 0;
      const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

      setStats({
        totalLeads,
        qualifiedLeads,
        conversionRate: Math.round(conversionRate),
        salesVelocity: Math.round(Math.random() * 20 + 10) // Mock data for now
      });

      // Get weekly leads data
      const { data: weeklyLeads } = await supabase
        .from('mv_leads_by_week')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('week_start', { ascending: true });

      if (weeklyLeads) {
        const formattedWeeklyData = weeklyLeads.map(item => ({
          week: new Date(item.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          leads: item.total_leads,
          qualified: item.qualified_leads,
        }));
        setWeeklyData(formattedWeeklyData);
      }

      // Get score distribution
      const { data: distribution } = await supabase
        .from('mv_score_distribution')
        .select('*')
        .eq('org_id', userProfile.org_id);

      if (distribution) {
        const formattedDistribution = distribution.map((item, index) => ({
          name: item.score_bucket,
          value: item.account_count,
          fill: SCORE_COLORS[index % SCORE_COLORS.length]
        }));
        setScoreDistribution(formattedDistribution);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const refreshViews = async () => {
    try {
      await supabase.rpc('refresh_reporting_views');
      loadDashboardData();
    } catch (error) {
      console.error('Error refreshing views:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your go-to-market intelligence overview</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              Accounts in pipeline
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.qualifiedLeads}</div>
            <p className="text-xs text-muted-foreground">
              Score ≥ 70
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Qualified from total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Velocity</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.salesVelocity} days</div>
            <p className="text-xs text-muted-foreground">
              Average cycle time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Leads Trend</CardTitle>
            <CardDescription>
              Lead volume and qualification over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="var(--color-leads)" 
                    strokeWidth={2}
                    name="Total Leads"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qualified" 
                    stroke="var(--color-qualified)" 
                    strokeWidth={2}
                    name="Qualified Leads"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>
              Account scores by decile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}