import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Target,
  BarChart3,
  FileSpreadsheet,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { parseCSV } from "@/utils/csv-parser";

interface EnrichedAccount {
  id: string;
  name: string;
  domain?: string;
  employee_count?: number;
  revenue_range?: string;
  industry_norm?: string;
  city?: string;
  country?: string;
}

interface GroundTruthRecord {
  domain?: string;
  company?: string;
  employee_count?: number;
  revenue_range?: string;
  industry?: string;
  city?: string;
  country?: string;
}

interface AccuracyResult {
  field: string;
  total: number;
  matches: number;
  closeMatches: number;
  mismatches: number;
  accuracy: number;
}

interface AccuracyBenchmarkProps {
  accounts: EnrichedAccount[];
  onBenchmarkComplete?: (results: AccuracyResult[]) => void;
}

export function AccuracyBenchmark({ accounts, onBenchmarkComplete }: AccuracyBenchmarkProps) {
  const [groundTruth, setGroundTruth] = useState<GroundTruthRecord[]>([]);
  const [results, setResults] = useState<AccuracyResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        toast.error("No data found in CSV");
        return;
      }

      // Map to ground truth format
      const mapped: GroundTruthRecord[] = data.map(row => {
        // Auto-detect column names
        const domain = row.domain || row.Domain || row.website || row.Website || '';
        const company = row.company || row.Company || row.company_name || row['Company Name'] || '';
        
        let employeeCount: number | undefined;
        const empRaw = row.employee_count || row.employees || row.Employees || row['Employee Count'] || row.headcount || '';
        if (empRaw) {
          const parsed = parseInt(String(empRaw).replace(/,/g, ''));
          if (!isNaN(parsed)) employeeCount = parsed;
        }
        
        return {
          domain: domain?.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
          company,
          employee_count: employeeCount,
          revenue_range: row.revenue_range || row.revenue || row.Revenue || row['Revenue Range'] || undefined,
          industry: row.industry || row.Industry || row.industry_norm || undefined,
          city: row.city || row.City || row.hq_city || undefined,
          country: row.country || row.Country || undefined,
        };
      });

      setGroundTruth(mapped);
      toast.success(`Loaded ${mapped.length} ground truth records`);
    } catch (error: any) {
      toast.error("Failed to parse CSV", { description: error.message });
    }
  };

  const runBenchmark = () => {
    if (groundTruth.length === 0) {
      toast.error("Please upload ground truth data first");
      return;
    }

    setIsProcessing(true);

    // Match accounts by domain
    const matchedPairs: Array<{ enriched: EnrichedAccount; truth: GroundTruthRecord }> = [];
    
    accounts.forEach(account => {
      if (!account.domain) return;
      const normalizedDomain = account.domain.toLowerCase().replace(/^www\./, '');
      const truthRecord = groundTruth.find(t => 
        t.domain === normalizedDomain || 
        t.company?.toLowerCase() === account.name?.toLowerCase()
      );
      if (truthRecord) {
        matchedPairs.push({ enriched: account, truth: truthRecord });
      }
    });

    if (matchedPairs.length === 0) {
      toast.error("No matching records found", { 
        description: "Make sure your ground truth CSV has matching domains or company names" 
      });
      setIsProcessing(false);
      return;
    }

    // Calculate accuracy per field
    const fieldResults: AccuracyResult[] = [];

    // Employee Count (allow 20% tolerance)
    const empPairs = matchedPairs.filter(p => p.truth.employee_count && p.enriched.employee_count);
    let empMatches = 0, empClose = 0, empMismatch = 0;
    empPairs.forEach(({ enriched, truth }) => {
      const diff = Math.abs((enriched.employee_count! - truth.employee_count!) / truth.employee_count!);
      if (diff <= 0.1) empMatches++;
      else if (diff <= 0.3) empClose++;
      else empMismatch++;
    });
    fieldResults.push({
      field: 'Employee Count',
      total: empPairs.length,
      matches: empMatches,
      closeMatches: empClose,
      mismatches: empMismatch,
      accuracy: empPairs.length > 0 ? Math.round(((empMatches + empClose * 0.5) / empPairs.length) * 100) : 0
    });

    // Revenue Range (exact match)
    const revPairs = matchedPairs.filter(p => p.truth.revenue_range && p.enriched.revenue_range);
    let revMatches = 0, revClose = 0;
    revPairs.forEach(({ enriched, truth }) => {
      if (enriched.revenue_range === truth.revenue_range) revMatches++;
      else {
        // Check if off by one bucket
        const buckets = ['$0-$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M', '$50M-$100M', '$100M-$500M', '$500M-$1B', '$1B-$10B', '$10B+'];
        const enrichedIdx = buckets.indexOf(enriched.revenue_range!);
        const truthIdx = buckets.indexOf(truth.revenue_range!);
        if (Math.abs(enrichedIdx - truthIdx) === 1) revClose++;
      }
    });
    fieldResults.push({
      field: 'Revenue Range',
      total: revPairs.length,
      matches: revMatches,
      closeMatches: revClose,
      mismatches: revPairs.length - revMatches - revClose,
      accuracy: revPairs.length > 0 ? Math.round(((revMatches + revClose * 0.5) / revPairs.length) * 100) : 0
    });

    // Industry (exact or similar match)
    const indPairs = matchedPairs.filter(p => p.truth.industry && p.enriched.industry_norm);
    let indMatches = 0;
    indPairs.forEach(({ enriched, truth }) => {
      const enrichedLower = enriched.industry_norm!.toLowerCase();
      const truthLower = truth.industry!.toLowerCase();
      if (enrichedLower === truthLower || enrichedLower.includes(truthLower) || truthLower.includes(enrichedLower)) {
        indMatches++;
      }
    });
    fieldResults.push({
      field: 'Industry',
      total: indPairs.length,
      matches: indMatches,
      closeMatches: 0,
      mismatches: indPairs.length - indMatches,
      accuracy: indPairs.length > 0 ? Math.round((indMatches / indPairs.length) * 100) : 0
    });

    // Location
    const locPairs = matchedPairs.filter(p => (p.truth.city || p.truth.country) && (p.enriched.city || p.enriched.country));
    let locMatches = 0;
    locPairs.forEach(({ enriched, truth }) => {
      const cityMatch = enriched.city?.toLowerCase() === truth.city?.toLowerCase();
      const countryMatch = enriched.country?.toLowerCase() === truth.country?.toLowerCase();
      if (cityMatch || countryMatch) locMatches++;
    });
    fieldResults.push({
      field: 'Location',
      total: locPairs.length,
      matches: locMatches,
      closeMatches: 0,
      mismatches: locPairs.length - locMatches,
      accuracy: locPairs.length > 0 ? Math.round((locMatches / locPairs.length) * 100) : 0
    });

    setResults(fieldResults);
    setHasRun(true);
    setIsProcessing(false);
    onBenchmarkComplete?.(fieldResults);
    
    const overallAccuracy = fieldResults.length > 0 
      ? Math.round(fieldResults.reduce((sum, r) => sum + r.accuracy, 0) / fieldResults.length)
      : 0;
    
    toast.success(`Benchmark complete! Overall accuracy: ${overallAccuracy}%`, {
      description: `Compared ${matchedPairs.length} records`
    });
  };

  const overallAccuracy = results.length > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / results.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Upload Ground Truth */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Accuracy Benchmark
          </CardTitle>
          <CardDescription>
            Compare enriched data against verified ground truth (e.g., ZoomInfo export)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload area */}
          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="ground-truth-upload"
            />
            <label htmlFor="ground-truth-upload" className="cursor-pointer">
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Upload Ground Truth CSV</p>
              <p className="text-xs text-muted-foreground mt-1">
                Include columns: domain, company, employee_count, revenue_range, industry
              </p>
            </label>
          </div>

          {groundTruth.length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Loaded {groundTruth.length} ground truth records. Ready to benchmark.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={runBenchmark} 
            disabled={groundTruth.length === 0 || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Run Benchmark
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {hasRun && results.length > 0 && (
        <>
          {/* Overall Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold" style={{ 
                  color: overallAccuracy >= 80 ? 'hsl(var(--chart-2))' : 
                         overallAccuracy >= 60 ? 'hsl(var(--chart-4))' : 
                         'hsl(var(--destructive))'
                }}>
                  {overallAccuracy}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Overall Accuracy</p>
              </div>
            </CardContent>
          </Card>

          {/* Field-by-Field Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Field Accuracy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.map((result) => (
                <div key={result.field} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{result.field}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.accuracy >= 80 ? "default" : result.accuracy >= 60 ? "secondary" : "destructive"}>
                        {result.accuracy}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({result.total} compared)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={result.accuracy} 
                    className={`h-2 ${
                      result.accuracy >= 80 ? '[&>div]:bg-green-500' : 
                      result.accuracy >= 60 ? '[&>div]:bg-amber-500' : 
                      '[&>div]:bg-red-500'
                    }`} 
                  />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {result.matches} exact
                    </span>
                    {result.closeMatches > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        {result.closeMatches} close
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-500" />
                      {result.mismatches} mismatch
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Interpretation Guide */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-1">
            <p><strong>Interpretation:</strong></p>
            <p>• <span className="text-green-600">80%+</span>: Excellent - Data is highly reliable</p>
            <p>• <span className="text-amber-600">60-79%</span>: Good - Minor discrepancies, review recommended</p>
            <p>• <span className="text-red-500">&lt;60%</span>: Needs improvement - Consider manual verification</p>
          </div>
        </>
      )}
    </div>
  );
}
