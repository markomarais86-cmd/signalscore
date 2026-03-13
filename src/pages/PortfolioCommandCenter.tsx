import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoles } from "@/hooks/use-roles";
import { usePortfolioMetrics, HealthStatus, PortfolioCompanyMetrics } from "@/hooks/use-portfolio-metrics";
import { useOrgSwitcher } from "@/contexts/OrgSwitcherContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Search,
  Target,
  Users,
  Zap,
  BarChart3,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { formatNumber } from "@/utils/format-numbers";

const healthColors: Record<HealthStatus, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-muted-foreground/40",
};

const healthLabels: Record<HealthStatus, string> = {
  green: "Healthy",
  amber: "Needs Attention",
  red: "At Risk",
  gray: "Not Started",
};

const healthIcons: Record<HealthStatus, typeof CheckCircle2> = {
  green: CheckCircle2,
  amber: AlertTriangle,
  red: XCircle,
  gray: MinusCircle,
};

function HealthBadge({ status }: { status: HealthStatus }) {
  const Icon = healthIcons[status];
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 text-xs font-medium ${
        status === "green"
          ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          : status === "amber"
          ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
          : status === "red"
          ? "border-red-500/30 text-red-600 dark:text-red-400"
          : "border-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {healthLabels[status]}
    </Badge>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: typeof Building2;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthDistribution({ metrics }: { metrics: PortfolioCompanyMetrics[] }) {
  const counts = { green: 0, amber: 0, red: 0, gray: 0 };
  metrics.forEach((m) => counts[m.overallHealth]++);
  const total = metrics.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">GTM Health Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["green", "amber", "red", "gray"] as HealthStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${healthColors[s]}`} />
            <span className="text-sm flex-1">{healthLabels[s]}</span>
            <span className="text-sm font-semibold">{counts[s]}</span>
            <span className="text-xs text-muted-foreground w-10 text-right">
              {total > 0 ? Math.round((counts[s] / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PortfolioCommandCenter() {
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const { setSelectedOrgId } = useOrgSwitcher();
  const { data: metrics, isLoading } = usePortfolioMetrics();
  const [search, setSearch] = useState("");

  if (!rolesLoading && !isSuperAdmin) {
    navigate("/dashboard");
    return null;
  }

  const filtered = (metrics ?? []).filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalAccounts = filtered.reduce((s, m) => s + m.totalAccounts, 0);
  const totalLeads = filtered.reduce((s, m) => s + m.totalLeads, 0);
  const totalCampaigns = filtered.reduce((s, m) => s + m.totalCampaigns, 0);
  const avgHealth = filtered.length > 0
    ? Math.round(filtered.reduce((s, m) => s + m.healthScore, 0) / filtered.length)
    : 0;

  const handleDrillDown = (orgId: string) => {
    setSelectedOrgId(orgId);
    navigate("/dashboard");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-portfolio GTM health diagnostics for all managed companies
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SummaryCard title="Portfolio Companies" value={filtered.length} icon={Building2} />
          <SummaryCard title="Total Accounts" value={formatNumber(totalAccounts)} icon={BarChart3} />
          <SummaryCard title="Total Leads" value={formatNumber(totalLeads)} icon={Users} />
          <SummaryCard title="Active Campaigns" value={totalCampaigns} icon={Zap} />
          <SummaryCard
            title="Avg GTM Health"
            value={`${avgHealth}%`}
            icon={TrendingUp}
            subtitle={avgHealth >= 70 ? "Strong" : avgHealth >= 40 ? "Moderate" : "Needs work"}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Health Distribution */}
        <div className="lg:col-span-1">
          {isLoading ? (
            <Skeleton className="h-52" />
          ) : (
            <HealthDistribution metrics={filtered} />
          )}
        </div>

        {/* Company Table */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Company Benchmarking</CardTitle>
            <CardDescription>Click a company to drill down into its dashboard</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-center">Health</TableHead>
                      <TableHead className="text-center">ICP</TableHead>
                      <TableHead className="text-right">Accounts</TableHead>
                      <TableHead className="text-center">Scoring %</TableHead>
                      <TableHead className="text-center">Enrichment %</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Campaigns</TableHead>
                      <TableHead className="text-right">Signals</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                          No portfolio companies found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered
                        .sort((a, b) => a.healthScore - b.healthScore) // worst first
                        .map((company) => (
                          <TableRow
                            key={company.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleDrillDown(company.id)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${healthColors[company.overallHealth]}`} />
                                {company.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <HealthBadge status={company.overallHealth} />
                            </TableCell>
                            <TableCell className="text-center">
                              {company.icpDefined ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="gap-1">
                                      <Target className="h-3 w-3" />
                                      {company.icpCount}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{company.icpCount} ICP profile(s) defined</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not set</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatNumber(company.totalAccounts)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={company.scoringCoverage} className="h-1.5 flex-1" />
                                <span className="text-xs font-mono w-8 text-right">{company.scoringCoverage}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={company.enrichmentCoverage} className="h-1.5 flex-1" />
                                <span className="text-xs font-mono w-8 text-right">{company.enrichmentCoverage}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatNumber(company.totalLeads)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {company.totalCampaigns}
                              {company.activeCampaigns > 0 && (
                                <span className="text-emerald-500 ml-1 text-xs">({company.activeCampaigns} live)</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {company.activeSignals > 0 ? (
                                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                                  {company.activeSignals}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
