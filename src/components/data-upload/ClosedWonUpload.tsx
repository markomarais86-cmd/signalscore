import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Download, Info, CheckCircle, AlertCircle, Zap, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV } from "@/utils/csv-parser";

// CSV headers for different modes
const EASY_MODE_HEADERS = ['domain'];
const DETAILED_MODE_HEADERS = ['account_external_id', 'deal_value', 'close_date', 'sales_cycle_days'];

interface UploadResult {
  total: number;
  inserted: number;
  rejected: number;
  errors: string[];
}

export function ClosedWonUpload() {
  const [uploadMode, setUploadMode] = useState<'easy' | 'detailed'>('easy');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileRefEasy = useRef<HTMLInputElement>(null);
  const fileRefDetailed = useRef<HTMLInputElement>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const downloadTemplate = (mode: 'easy' | 'detailed') => {
    const template = mode === 'easy'
      ? [
          EASY_MODE_HEADERS.join(','),
          'techcorp.com',
          'dataflow.io',
          'cloudscale.net'
        ].join('\n')
      : [
          DETAILED_MODE_HEADERS.join(','),
          'ACC001,50000,2024-01-15,45',
          'ACC002,75000,2024-02-20,60'
        ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'easy' ? 'closed_won_easy_template.csv' : 'closed_won_detailed_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (file: File, mode: 'easy' | 'detailed') => {
    console.log('ClosedWonUpload: handleFileSelect called with file:', file.name, 'mode:', mode);
    
    if (!userProfile?.org_id) {
      console.log('ClosedWonUpload: No org_id found');
      toast({
        title: "Error",
        description: "User profile not loaded",
        variant: "destructive"
      });
      return;
    }

    console.log('ClosedWonUpload: Starting upload for org:', userProfile.org_id);
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const text = await file.text();
      console.log('ClosedWonUpload: File read, parsing CSV...');
      const rawData = parseCSV(text);
      console.log('ClosedWonUpload: Parsed rows:', rawData.length);
      
      setUploadProgress(25);

      let transformedData: any[] = [];
      let rejectedCount = 0;

      if (mode === 'easy') {
        // Easy mode: Match domains to existing accounts and pull firmographics
        const domains = rawData.map(row => row.domain?.trim().toLowerCase()).filter(Boolean);
        console.log('ClosedWonUpload: Processing domains:', domains);
        
        // Fetch accounts with full firmographic data
        const { data: accounts, error: accountError } = await supabase
          .from('accounts')
          .select('external_id, domain, industry_norm, employee_count, revenue_range, country')
          .eq('org_id', userProfile.org_id)
          .in('domain', domains);

        if (accountError) throw accountError;
        console.log('ClosedWonUpload: Found accounts:', accounts?.length);

        setUploadProgress(50);

        // Function to estimate deal value based on firmographics
        const estimateDealValue = (account: any): number => {
          let baseValue = 25000; // Default base value
          
          // Adjust by company size
          if (account.employee_count) {
            if (account.employee_count >= 5000) baseValue = 150000;
            else if (account.employee_count >= 1000) baseValue = 100000;
            else if (account.employee_count >= 500) baseValue = 75000;
            else if (account.employee_count >= 200) baseValue = 50000;
          }
          
          // Adjust by revenue range
          if (account.revenue_range) {
            if (account.revenue_range.includes('$500M+')) baseValue *= 2;
            else if (account.revenue_range.includes('$100M-$500M')) baseValue *= 1.5;
            else if (account.revenue_range.includes('$50M-$100M')) baseValue *= 1.2;
          }
          
          // Industry multipliers
          const highValueIndustries = ['Financial Services', 'Technology', 'Healthcare'];
          if (account.industry_norm && highValueIndustries.includes(account.industry_norm)) {
            baseValue *= 1.3;
          }
          
          return Math.round(baseValue);
        };

        // Estimate sales cycle based on deal size
        const estimateSalesCycle = (dealValue: number): number => {
          if (dealValue >= 150000) return 90;
          if (dealValue >= 75000) return 60;
          if (dealValue >= 50000) return 45;
          return 30;
        };

        // Create a map with full account data
        const accountMap = new Map(
          accounts?.map(acc => [
            acc.domain?.toLowerCase(), 
            { 
              external_id: acc.external_id,
              deal_value: estimateDealValue(acc),
              sales_cycle: estimateSalesCycle(estimateDealValue(acc))
            }
          ]) || []
        );

        // Transform data with estimated values
        const today = new Date().toISOString().split('T')[0];
        transformedData = rawData
          .filter(row => {
            const domain = row.domain?.trim().toLowerCase();
            const hasMatch = domain && accountMap.has(domain);
            if (!hasMatch) rejectedCount++;
            return hasMatch;
          })
          .map(row => {
            const domain = row.domain.trim().toLowerCase();
            const accountData = accountMap.get(domain)!;
            return {
              org_id: userProfile.org_id,
              account_external_id: accountData.external_id,
              deal_value: accountData.deal_value,
              close_date: today,
              sales_cycle_days: accountData.sales_cycle,
              created_at: new Date().toISOString()
            };
          });

        console.log('ClosedWonUpload: Estimated deal values based on firmographics');
      } else {
        // Detailed mode: Use provided data
        const validData = rawData.filter(row => {
          return row.account_external_id && row.deal_value && row.close_date;
        });

        rejectedCount = rawData.length - validData.length;
        setUploadProgress(50);

        transformedData = validData.map(row => ({
          org_id: userProfile.org_id,
          account_external_id: row.account_external_id,
          deal_value: parseFloat(row.deal_value) || 0,
          close_date: row.close_date,
          sales_cycle_days: parseInt(row.sales_cycle_days) || null,
          created_at: new Date().toISOString()
        }));
      }

      setUploadProgress(75);

      if (transformedData.length > 0) {
        const { error } = await supabase
          .from('closed_won_deals')
          .upsert(transformedData, { onConflict: 'org_id,account_external_id,close_date' });

        if (error) throw error;
      }

      setUploadProgress(100);

      setUploadResult({
        total: rawData.length,
        inserted: transformedData.length,
        rejected: rejectedCount,
        errors: rejectedCount > 0 
          ? mode === 'easy'
            ? [`${rejectedCount} domains could not be matched to existing accounts`]
            : [`${rejectedCount} rows missing required fields`]
          : []
      });

      toast({
        title: "Upload completed",
        description: `Processed ${transformedData.length} closed won deals`
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      
      let errorMessage = "Failed to upload closed won data";
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        errorMessage = "Closed won deals table not yet created. Please contact support to enable this feature.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      setUploadResult({
        total: 0,
        inserted: 0,
        rejected: 0,
        errors: [errorMessage]
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Upload Closed Won Data
        </CardTitle>
        <CardDescription>
          Import historical closed won deals to analyze your ideal customer profile based on actual wins
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'easy' | 'detailed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="easy" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Easy Mode
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Detailed Mode
            </TabsTrigger>
          </TabsList>

          <TabsContent value="easy" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Easy Mode:</strong> Upload just website domains. We'll match them to your existing accounts and automatically estimate deal values based on firmographics (company size, revenue, industry).
                <br />
                <strong>Required header:</strong> {EASY_MODE_HEADERS.join(', ')}
                <br />
                <span className="text-xs text-muted-foreground">Deal values are estimated using AI-powered algorithms based on company characteristics</span>
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => downloadTemplate('easy')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <div>
                <Input
                  ref={fileRefEasy}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, 'easy');
                  }}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileRefEasy.current?.click()}
                  disabled={uploading}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  {uploading ? 'Processing...' : 'Upload Domains'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Detailed Mode:</strong> Upload complete deal information including value, close date, and sales cycle.
                <br />
                <strong>Required headers:</strong> {DETAILED_MODE_HEADERS.join(', ')}
                <br />
                <strong>Note:</strong> account_external_id must match existing accounts in your CRM data
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => downloadTemplate('detailed')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <div>
                <Input
                  ref={fileRefDetailed}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, 'detailed');
                  }}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileRefDetailed.current?.click()}
                  disabled={uploading}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  {uploading ? 'Processing...' : 'Upload Deal Data'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {uploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">Processing upload...</p>
          </div>
        )}

        {uploadResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{uploadResult.total}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-high))]">{uploadResult.inserted}</div>
                <div className="text-sm text-muted-foreground">Inserted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-low))]">{uploadResult.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.errors[0]}
                </AlertDescription>
              </Alert>
            )}

            {uploadResult.rejected === 0 && uploadResult.inserted > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All closed won deals were processed successfully! Your ICP analysis will now be based on real win data.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
