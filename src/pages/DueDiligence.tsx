import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRoles } from "@/hooks/use-roles";
import { parseCSV, analyzeCrmExport, DueDiligenceReport } from "@/lib/due-diligence-engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileText,
  Shield,
  BarChart3,
  Target,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  Eye,
  ArrowLeft,
} from "lucide-react";

const gradeColors: Record<string, string> = {
  A: "text-primary bg-primary/10 border-primary/30",
  B: "text-secondary-foreground bg-secondary/30 border-secondary/40",
  C: "text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.1)] border-[hsl(var(--status-warning)/0.3)]",
  D: "text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.15)] border-[hsl(var(--status-warning)/0.4)]",
  F: "text-destructive bg-destructive/10 border-destructive/30",
};

function ScoreCard({ title, score, grade, icon: Icon, children }: {
  title: string;
  score: number;
  grade: string;
  icon: typeof BarChart3;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${gradeColors[grade]}`}>
            {grade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Progress value={score} className="h-2 flex-1" />
          <span className="text-sm font-mono font-semibold w-10 text-right">{score}%</span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-muted-foreground truncate">{label}</span>
      <Progress value={value} className="h-1.5 flex-1" />
      <span className="font-mono w-8 text-right">{value}%</span>
    </div>
  );
}

function DistributionTable({ data, label }: { data: { name: string; count: number; pct: number }[]; label: string }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No {label.toLowerCase()} data detected</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">{label}</TableHead>
          <TableHead className="text-xs text-right">Count</TableHead>
          <TableHead className="text-xs text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="text-xs py-1.5">{row.name}</TableCell>
            <TableCell className="text-xs py-1.5 text-right font-mono">{row.count}</TableCell>
            <TableCell className="text-xs py-1.5 text-right font-mono">{row.pct}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FindingsPanel({ findings }: { findings: DueDiligenceReport["findings"] }) {
  const icons = {
    positive: <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))] shrink-0" />,
    critical: <XCircle className="h-4 w-4 text-destructive shrink-0" />,
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Key Findings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {findings.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {icons[f.type]}
            <span>{f.text}</span>
          </div>
        ))}
        {findings.length === 0 && (
          <p className="text-sm text-muted-foreground">Upload a CRM export to generate findings</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DueDiligencePage() {
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [report, setReport] = useState<DueDiligenceReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!rolesLoading && !isSuperAdmin) {
    navigate("/dashboard");
    return null;
  }

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }
      setError(null);
      setIsProcessing(true);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const { headers, records } = parseCSV(text);
          if (records.length === 0) {
            setError("CSV file is empty or invalid");
            setIsProcessing(false);
            return;
          }
          const name = companyName.trim() || file.name.replace(/\.csv$/i, "");
          const result = analyzeCrmExport(headers, records, name);
          setReport(result);
        } catch (err) {
          setError("Failed to parse CSV file");
        }
        setIsProcessing(false);
      };
      reader.readAsText(file);
    },
    [companyName]
  );

  const handleReset = () => {
    setReport(null);
    setFileName(null);
    setError(null);
    setCompanyName("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Due Diligence Mode</h1>
            <Badge variant="outline" className="gap-1 text-xs">
              <Eye className="h-3 w-3" />
              Read-Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a target company's CRM export for instant ICP/TAM/pipeline quality assessment
          </p>
        </div>
        {report && (
          <Button variant="outline" onClick={handleReset}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            New Assessment
          </Button>
        )}
      </div>

      {/* Upload Section */}
      {!report && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="rounded-full bg-primary/10 p-5">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold">Upload CRM Export</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Upload a CSV export from Salesforce, HubSpot, or any CRM. The assessment runs entirely
                in your browser — no data is stored or sent to any server.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
              <Input
                placeholder="Target company name (optional)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="flex-1"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
                <Button asChild disabled={isProcessing}>
                  <span>
                    <FileText className="h-4 w-4 mr-2" />
                    {isProcessing ? "Analyzing..." : "Select CSV"}
                  </span>
                </Button>
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2 justify-center">
              {["Accounts", "Contacts", "Opportunities", "Leads"].map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">{t} CSV</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Report Header */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-primary" />
                    <h2 className="text-xl font-bold">{report.companyName}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {report.recordCount.toLocaleString()} records analyzed from {fileName} •{" "}
                    {new Date(report.generatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-bold rounded-xl border-2 px-6 py-3 ${gradeColors[report.overallGrade]}`}>
                    {report.overallGrade}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Overall: {report.overallScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Findings */}
          <FindingsPanel findings={report.findings} />

          {/* Score Cards */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Data Quality */}
            <ScoreCard title="Data Quality" score={report.dataQuality.score} grade={report.dataQuality.grade} icon={Shield}>
              <div className="space-y-1.5">
                <CoverageBar label="Email" value={report.dataQuality.emailCoverage} />
                <CoverageBar label="Phone" value={report.dataQuality.phoneCoverage} />
                <CoverageBar label="Domain" value={report.dataQuality.domainCoverage} />
                <CoverageBar label="Industry" value={report.dataQuality.industryCoverage} />
                <CoverageBar label="Revenue" value={report.dataQuality.revenueCoverage} />
                <CoverageBar label="Employees" value={report.dataQuality.employeeCoverage} />
              </div>
              {report.dataQuality.missingCriticalFields.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Missing:</span>
                  {report.dataQuality.missingCriticalFields.map((f) => (
                    <Badge key={f} variant="destructive" className="text-[10px] px-1.5 py-0">{f}</Badge>
                  ))}
                </div>
              )}
            </ScoreCard>

            {/* Pipeline Quality */}
            <ScoreCard
              title="Pipeline Quality"
              score={report.pipelineQuality.score}
              grade={gradeFromScore(report.pipelineQuality.score)}
              icon={TrendingUp}
            >
              {report.pipelineQuality.totalDeals === 0 ? (
                <p className="text-xs text-muted-foreground">No pipeline/stage data detected in this export</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-md bg-muted/50">
                      <p className="text-lg font-bold">{report.pipelineQuality.totalDeals}</p>
                      <p className="text-[10px] text-muted-foreground">Total Deals</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/50">
                      <p className="text-lg font-bold">{report.pipelineQuality.avgWinRate ?? "—"}%</p>
                      <p className="text-[10px] text-muted-foreground">Win Rate</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/50">
                      <p className="text-lg font-bold">{report.pipelineQuality.staleDealsPct}%</p>
                      <p className="text-[10px] text-muted-foreground">Stale Deals</p>
                    </div>
                  </div>
                  <DistributionTable data={report.pipelineQuality.stageDistribution.map(s => ({ name: s.stage, count: s.count, pct: s.pct }))} label="Stage" />
                </div>
              )}
            </ScoreCard>
          </div>

          {/* ICP & TAM */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Industry */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Industry Distribution</CardTitle>
                </div>
                {report.icpAnalysis.concentrationRisk > 50 && (
                  <CardDescription className="text-xs text-[hsl(var(--status-warning))]">
                    ⚠ High concentration in {report.icpAnalysis.topIndustry}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <DistributionTable data={report.icpAnalysis.industryDistribution} label="Industry" />
              </CardContent>
            </Card>

            {/* Size */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Company Size</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {report.icpAnalysis.sizeDistribution.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Employees</TableHead>
                        <TableHead className="text-xs text-right">Count</TableHead>
                        <TableHead className="text-xs text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.icpAnalysis.sizeDistribution.map((row) => (
                        <TableRow key={row.band}>
                          <TableCell className="text-xs py-1.5">{row.band}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono">{row.count}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono">{row.pct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-muted-foreground">No employee data detected</p>
                )}
              </CardContent>
            </Card>

            {/* TAM */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">TAM Estimate</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-lg font-bold">{report.tamEstimate.totalAccounts.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Total Records</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-lg font-bold">{report.tamEstimate.uniqueDomains.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Unique Domains</p>
                  </div>
                </div>
                <Separator />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Estimated TAM</p>
                  <p className="text-2xl font-bold text-primary">{report.tamEstimate.estimatedTAM}</p>
                  {report.tamEstimate.avgDealSize && (
                    <p className="text-xs text-muted-foreground">
                      Avg deal: ${report.tamEstimate.avgDealSize.toLocaleString()}
                    </p>
                  )}
                </div>
                {report.tamEstimate.revenueSegments.length > 0 && (
                  <>
                    <Separator />
                    <DistributionTable data={report.tamEstimate.revenueSegments.map(r => ({ name: r.range, count: r.count, pct: r.pct }))} label="Revenue" />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Geography */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Geographic Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {report.icpAnalysis.geoDistribution.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {report.icpAnalysis.geoDistribution.map((g) => (
                    <div key={g.name} className="flex items-center justify-between rounded-md border p-2">
                      <span className="text-sm">{g.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{g.count}</span>
                        <Badge variant="secondary" className="text-[10px]">{g.pct}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No geography data detected in this export</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function gradeFromScore(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}
