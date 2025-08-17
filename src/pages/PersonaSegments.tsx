import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Users, Crown, Building, TrendingUp, Target, Star } from "lucide-react";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";

const chartConfig = {
  signalScore: {
    label: "SignalScore",
    color: "hsl(var(--chart-1))",
  },
  conversion: {
    label: "Conversion Rate",
    color: "hsl(var(--chart-2))",
  }
};

export default function PersonaSegments() {
  const [selectedSegment, setSelectedSegment] = useState("all");
  
  // Mock persona data
  const personaData = [
    {
      title: "Chief Executive Officer",
      segment: "Enterprise",
      signalScore: 92,
      trend: 5,
      accounts: 145,
      conversion: 68,
      revenue: "$2.1M",
      topSignals: ["Company Growth", "Funding Events", "Tech Stack Changes"],
      performance: "high"
    },
    {
      title: "VP of Sales",
      segment: "Mid-Market", 
      signalScore: 87,
      trend: 3,
      accounts: 320,
      conversion: 45,
      revenue: "$1.8M",
      topSignals: ["Hiring Plans", "Revenue Targets", "Tool Evaluation"],
      performance: "high"
    },
    {
      title: "Marketing Director",
      segment: "SMB",
      signalScore: 73,
      trend: -2,
      accounts: 680,
      conversion: 32,
      revenue: "$890K",
      topSignals: ["Budget Planning", "Campaign Performance", "Lead Quality"],
      performance: "medium"
    },
    {
      title: "IT Manager",
      segment: "Mid-Market",
      signalScore: 68,
      trend: 1,
      accounts: 420,
      conversion: 28,
      revenue: "$650K",
      topSignals: ["System Integration", "Security Concerns", "Cost Optimization"],
      performance: "medium"
    },
    {
      title: "Operations Manager",
      segment: "SMB",
      signalScore: 45,
      trend: -8,
      accounts: 890,
      conversion: 18,
      revenue: "$320K",
      topSignals: ["Process Efficiency", "Resource Planning", "Compliance"],
      performance: "low"
    }
  ];

  // Mock segment comparison data
  const segmentData = [
    { segment: "Enterprise", signalScore: 89, conversion: 58, accounts: 245, avgDeal: 85000 },
    { segment: "Mid-Market", signalScore: 76, conversion: 38, accounts: 820, avgDeal: 25000 },
    { segment: "SMB", signalScore: 62, conversion: 28, accounts: 1650, avgDeal: 8500 }
  ];

  // Mock radar chart data for persona analysis
  const radarData = [
    { metric: "Intent Signal", score: 85, maxScore: 100 },
    { metric: "Fit Score", score: 78, maxScore: 100 },
    { metric: "Reachability", score: 92, maxScore: 100 },
    { metric: "Timing", score: 74, maxScore: 100 },
    { metric: "Authority", score: 88, maxScore: 100 },
    { metric: "Budget", score: 82, maxScore: 100 }
  ];

  const getPerformanceBadge = (performance: string) => {
    const variants = {
      high: "default",
      medium: "secondary", 
      low: "outline"
    } as const;
    
    const colors = {
      high: "text-[hsl(var(--signal-high))]",
      medium: "text-[hsl(var(--signal-medium))]",
      low: "text-[hsl(var(--signal-low))]"
    };

    return (
      <Badge variant={variants[performance as keyof typeof variants]} className={colors[performance as keyof typeof colors]}>
        {performance.toUpperCase()}
      </Badge>
    );
  };

  const getSegmentIcon = (segment: string) => {
    switch (segment) {
      case "Enterprise": return <Building className="h-4 w-4" />;
      case "Mid-Market": return <Users className="h-4 w-4" />;
      case "SMB": return <Star className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const filteredPersonas = selectedSegment === "all" 
    ? personaData 
    : personaData.filter(p => p.segment.toLowerCase() === selectedSegment);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Persona & Segments</h1>
          <p className="text-muted-foreground">Performance breakdown by role and market segment</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedSegment} onValueChange={setSelectedSegment}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="mid-market">Mid-Market</SelectItem>
              <SelectItem value="smb">SMB</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Segment Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {segmentData.map((segment) => (
          <Card key={segment.segment}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                {getSegmentIcon(segment.segment)}
                <CardTitle className="text-sm font-medium">{segment.segment}</CardTitle>
              </div>
              <SignalScoreDisplay score={segment.signalScore} size="sm" showLabel={false} />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Conversion:</span>
                  <span className="font-medium">{segment.conversion}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Accounts:</span>
                  <span className="font-medium">{segment.accounts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Deal:</span>
                  <span className="font-medium">${segment.avgDeal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Persona Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Persona Performance Analysis</CardTitle>
          <CardDescription>
            SignalScore and conversion rates by role and segment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPersonas.map((persona, index) => (
              <div key={persona.title} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getSegmentIcon(persona.segment)}
                      <div>
                        <h3 className="font-semibold">{persona.title}</h3>
                        <p className="text-sm text-muted-foreground">{persona.segment}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getPerformanceBadge(persona.performance)}
                    <SignalScoreDisplay 
                      score={persona.signalScore} 
                      size="md" 
                      trend={persona.trend}
                      showLabel={false}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-lg font-bold">{persona.accounts}</div>
                    <div className="text-xs text-muted-foreground">Accounts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{persona.conversion}%</div>
                    <div className="text-xs text-muted-foreground">Conversion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{persona.revenue}</div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{persona.trend > 0 ? '+' : ''}{persona.trend}</div>
                    <div className="text-xs text-muted-foreground">Trend</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Top Signals:</div>
                  <div className="flex flex-wrap gap-1">
                    {persona.topSignals.map((signal) => (
                      <Badge key={signal} variant="outline" className="text-xs">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Analysis Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Segment Performance Comparison</CardTitle>
            <CardDescription>
              SignalScore vs conversion rate by segment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="segment" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="signalScore" 
                    fill="var(--color-signalScore)"
                    name="SignalScore"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signal Breakdown Analysis</CardTitle>
            <CardDescription>
              Detailed signal component scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}