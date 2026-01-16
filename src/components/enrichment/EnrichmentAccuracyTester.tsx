import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, TestTube, CheckCircle2, XCircle, Target, Upload, Beaker } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AccuracyResult {
  source: string;
  total_tested: number;
  phone_accuracy: number;
  employee_count_accuracy: number;
  revenue_accuracy: number;
  industry_accuracy: number;
  naics_accuracy: number;
  overall_accuracy: number;
  avg_duration_ms: number;
  total_cost: number;
}

interface TestDataRecord {
  input_name: string;
  input_company: string;
  input_email: string;
  input_domain: string;
  expected_phone: string;
  expected_employee_count: number;
  expected_revenue_range: string;
  expected_industry: string;
}

export function EnrichmentAccuracyTester() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<AccuracyResult[]>([]);
  const [testType, setTestType] = useState<'lead' | 'account'>('account');
  const [selectedSources, setSelectedSources] = useState<string[]>(['gemini', 'perplexity', 'firecrawl']);
  const [testDataCount, setTestDataCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  const sources = [
    { id: 'gemini', label: 'Gemini', cost: '$0.003' },
    { id: 'perplexity', label: 'Perplexity', cost: '$0.005' },
    { id: 'firecrawl', label: 'Firecrawl', cost: '$0.005' },
    { id: 'apollo', label: 'Apollo', cost: '$0.05-0.10' },
    { id: 'pdl', label: 'PDL', cost: '$0.03-0.08' },
  ];

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId]
    );
  };

  const loadTestDataCount = async () => {
    if (!orgId) return;
    
    const { count } = await supabase
      .from('enrichment_test_data')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('test_type', testType);
    
    setTestDataCount(count || 0);
  };

  const runAccuracyTest = async () => {
    if (!orgId) {
      toast({ title: "Organization not found", variant: "destructive" });
      return;
    }

    if (selectedSources.length === 0) {
      toast({ title: "Select at least one source to test", variant: "destructive" });
      return;
    }

    setTesting(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-test-accuracy', {
        body: {
          test_type: testType,
          sources_to_test: selectedSources,
          sample_size: 50,
          org_id: orgId
        }
      });

      if (error) throw error;

      setResults(data.results || []);
      toast({
        title: "Accuracy test completed",
        description: `Tested ${data.total_test_records} records across ${selectedSources.length} sources`
      });
    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const addSampleTestData = async () => {
    if (!orgId) return;
    setImporting(true);

    // Add some sample test data for demonstration
    const sampleData: Partial<TestDataRecord>[] = [
      {
        input_company: "Stripe",
        input_domain: "stripe.com",
        expected_employee_count: 8000,
        expected_revenue_range: "$1B-$10B",
        expected_industry: "Financial Technology"
      },
      {
        input_company: "Figma",
        input_domain: "figma.com",
        expected_employee_count: 1500,
        expected_revenue_range: "$500M-$1B",
        expected_industry: "Software"
      },
      {
        input_company: "Notion",
        input_domain: "notion.so",
        expected_employee_count: 600,
        expected_revenue_range: "$100M-$500M",
        expected_industry: "Software"
      },
      {
        input_company: "Linear",
        input_domain: "linear.app",
        expected_employee_count: 100,
        expected_revenue_range: "$10M-$25M",
        expected_industry: "Software"
      },
      {
        input_company: "Vercel",
        input_domain: "vercel.com",
        expected_employee_count: 500,
        expected_revenue_range: "$100M-$500M",
        expected_industry: "Software"
      }
    ];

    try {
      const { error } = await supabase.from('enrichment_test_data').insert(
        sampleData.map(d => ({
          ...d,
          org_id: orgId,
          test_type: 'account',
          source: 'sample',
          verified_date: new Date().toISOString()
        }))
      );

      if (error) throw error;

      toast({ title: `Added ${sampleData.length} sample test records` });
      loadTestDataCount();
    } catch (error: any) {
      toast({
        title: "Failed to add sample data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return "text-green-600 bg-green-100";
    if (accuracy >= 70) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5" />
              Enrichment Accuracy Benchmark
            </CardTitle>
            <CardDescription>
              Test enrichment sources against known-good data to measure accuracy
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Test Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={testType === 'account' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setTestType('account'); loadTestDataCount(); }}
              >
                Account
              </Button>
              <Button
                variant={testType === 'lead' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setTestType('lead'); loadTestDataCount(); }}
              >
                Lead
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Test Data Available</Label>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{testDataCount} records</Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={addSampleTestData}
                disabled={importing}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Add Samples
              </Button>
            </div>
          </div>
        </div>

        {/* Source Selection */}
        <div>
          <Label className="text-sm font-medium">Sources to Test</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {sources.map(source => (
              <label
                key={source.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedSources.includes(source.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Checkbox
                  checked={selectedSources.includes(source.id)}
                  onCheckedChange={() => toggleSource(source.id)}
                />
                <span className="text-sm">{source.label}</span>
                <Badge variant="outline" className="text-xs">{source.cost}</Badge>
              </label>
            ))}
          </div>
        </div>

        {/* Run Test Button */}
        <Button 
          onClick={runAccuracyTest} 
          disabled={testing || testDataCount === 0}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Accuracy Tests...
            </>
          ) : (
            <>
              <Target className="mr-2 h-4 w-4" />
              Run Accuracy Benchmark
            </>
          )}
        </Button>

        {/* Results Table */}
        {results.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Phone</TableHead>
                  <TableHead className="text-center">Employees</TableHead>
                  <TableHead className="text-center">Revenue</TableHead>
                  <TableHead className="text-center">Industry</TableHead>
                  <TableHead className="text-center">Overall</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(result => (
                  <TableRow key={result.source}>
                    <TableCell className="font-medium capitalize">{result.source}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAccuracyColor(result.phone_accuracy)}>
                        {result.phone_accuracy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAccuracyColor(result.employee_count_accuracy)}>
                        {result.employee_count_accuracy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAccuracyColor(result.revenue_accuracy)}>
                        {result.revenue_accuracy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAccuracyColor(result.industry_accuracy)}>
                        {result.industry_accuracy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAccuracyColor(result.overall_accuracy)}>
                        {result.overall_accuracy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(result.avg_duration_ms / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${result.total_cost.toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
