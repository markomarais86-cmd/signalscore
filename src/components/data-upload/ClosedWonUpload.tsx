import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Download, Info, CheckCircle, AlertCircle, Zap, ListChecks, Database, HelpCircle, RefreshCw, FileQuestion } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV } from "@/utils/csv-parser";
import { SampleDataGenerator } from "@/components/SampleDataGenerator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'checking' | 'connected' | 'error' | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const fileRefEasy = useRef<HTMLInputElement>(null);
  const fileRefDetailed = useRef<HTMLInputElement>(null);
  const { userProfile, user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Check database connection and prerequisites on mount
  useEffect(() => {
    checkDatabaseConnection();
  }, [userProfile?.org_id]);

  const checkDatabaseConnection = async () => {
    console.log('ClosedWonUpload: Checking DB connection. Auth loading:', authLoading, 'User:', !!user, 'Profile:', !!userProfile, 'Org ID:', userProfile?.org_id);
    
    if (!userProfile?.org_id) {
      // Don't set error if we're still loading auth
      if (!authLoading && user) {
        setDbConnectionStatus('error');
        setDbError('User profile not found. Please sign out and sign back in.');
      }
      return;
    }

    setDbConnectionStatus('checking');
    try {
      // Test 1: Check if we can query accounts table
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(1);

      if (accountsError) {
        throw new Error(`Database connection error: ${accountsError.message}`);
      }

      // Test 2: Check if closed_won_deals table exists
      const { error: tableError } = await supabase
        .from('closed_won_deals')
        .select('id')
        .limit(0);

      if (tableError && tableError.message?.includes('does not exist')) {
        throw new Error('Closed won deals table not configured. Contact support to enable this feature.');
      }

      // Test 3: Get account count for validation
      const { count } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      setAccountCount(count || 0);
      setDbConnectionStatus('connected');
      setDbError(null);
    } catch (error: any) {
      console.error('Database connection check failed:', error);
      setDbConnectionStatus('error');
      setDbError(error.message || 'Unknown database error');
    }
  };

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
        // Easy mode: Match domains to existing accounts
        // Firmographics (industry, revenue, employee count, sub-industries, etc.) 
        // will be automatically pulled from the accounts table during analysis
        const domains = rawData.map(row => row.domain?.trim().toLowerCase()).filter(Boolean);
        console.log('ClosedWonUpload: Processing domains:', domains);
        
        // Fetch accounts matching these domains
        const { data: accounts, error: accountError } = await supabase
          .from('accounts')
          .select('external_id, domain')
          .eq('org_id', userProfile.org_id)
          .in('domain', domains);

        if (accountError) throw accountError;
        console.log('ClosedWonUpload: Found accounts:', accounts?.length);

        setUploadProgress(50);

        // Create a map of domain to account_external_id
        const domainMap = new Map(
          accounts?.map(acc => [acc.domain?.toLowerCase(), acc.external_id]) || []
        );

        // Transform data - firmographics will be pulled from accounts table during analysis
        const today = new Date().toISOString().split('T')[0];
        transformedData = rawData
          .filter(row => {
            const domain = row.domain?.trim().toLowerCase();
            const hasMatch = domain && domainMap.has(domain);
            if (!hasMatch) rejectedCount++;
            return hasMatch;
          })
          .map(row => ({
            org_id: userProfile.org_id,
            account_external_id: domainMap.get(row.domain.trim().toLowerCase()),
            deal_value: 0, // Placeholder - actual value not needed for firmographic analysis
            close_date: today,
            sales_cycle_days: null,
            created_at: new Date().toISOString()
          }));

        console.log('ClosedWonUpload: Matched domains to accounts, firmographics will be pulled from accounts table');
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
    <div className="space-y-6">
      {/* Loading State */}
      {(authLoading || (user && !userProfile)) && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading user profile...</AlertTitle>
          <AlertDescription>
            Please wait while we load your account information.
          </AlertDescription>
        </Alert>
      )}

      {/* Not Authenticated */}
      {!authLoading && !user && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to upload closed won data.
            <div className="mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.href = '/auth'}
              >
                Sign In
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Database Connection Status */}
      {dbConnectionStatus === 'checking' && userProfile && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Checking database connection...</AlertTitle>
        </Alert>
      )}

      {dbConnectionStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Connection Issue</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{dbError}</p>
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkDatabaseConnection}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Troubleshooting
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showTroubleshooting && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Troubleshooting Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Common Issues:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Not signed in:</strong> Sign out and sign back in to refresh your session</li>
                <li><strong>No accounts:</strong> Upload CRM accounts data first before uploading closed won deals</li>
                <li><strong>Table not found:</strong> Contact support to enable closed won tracking for your organization</li>
                <li><strong>Network issues:</strong> Check your internet connection and try again</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Try These Steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Refresh this page</li>
                <li>Check that you have uploaded account data</li>
                <li>Try using demo data to test the system</li>
                <li>Contact support if the issue persists</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Accounts Warning */}
      {dbConnectionStatus === 'connected' && accountCount === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Accounts Found</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>You need to upload account data before uploading closed won deals.</p>
            <div className="space-y-2">
              <p className="text-sm font-semibold">You have two options:</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm mb-2">1. Generate sample data to explore the platform:</p>
                  <SampleDataGenerator />
                </div>
                <div>
                  <p className="text-sm">2. Upload your own account data first:</p>
                  <Button 
                    variant="outline"
                    onClick={() => window.location.href = '/data-upload?tab=accounts'}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Upload Accounts
                  </Button>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Preparation Guide */}
      {dbConnectionStatus === 'connected' && accountCount > 0 && (
        <Collapsible>
          <Card className="border-primary/20">
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <FileQuestion className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Data Preparation Guide</CardTitle>
                  </div>
                  <Info className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3 text-sm pt-0">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>You have {accountCount} accounts</strong> in your database. Here's how to prepare your closed won data:
                  </AlertDescription>
                </Alert>
                
                <div>
                  <h4 className="font-semibold mb-2">Easy Mode (Recommended):</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Simply list the website domains of companies you've won</li>
                    <li>We'll automatically match them to your existing accounts</li>
                    <li>All firmographics will be pulled from your account data</li>
                    <li>Best for quick analysis without deal-specific details</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Detailed Mode (Advanced):</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Include deal value, close date, and sales cycle length</li>
                    <li>Use the exact account_external_id from your CRM</li>
                    <li>Enables revenue and velocity analysis</li>
                    <li>Best for comprehensive sales intelligence</li>
                  </ul>
                </div>

                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="font-semibold mb-1">Pro Tip:</p>
                  <p className="text-muted-foreground">
                    Start with Easy Mode to quickly identify patterns. You can always upload detailed data later for deeper insights.
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Main Upload Card */}
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
                <strong>Easy Mode:</strong> Upload just website domains. We'll match them to your existing accounts and automatically pull all firmographics (industry, revenue, employee count, sub-industries, etc.) from your CRM data for analysis.
                <br />
                <strong>Required header:</strong> {EASY_MODE_HEADERS.join(', ')}
                <br />
                <span className="text-xs text-muted-foreground">ICP recommendations will be generated from the actual firmographic data in your accounts</span>
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
              disabled={uploading || !userProfile || dbConnectionStatus !== 'connected' || accountCount === 0}
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
                  disabled={uploading || !userProfile || dbConnectionStatus !== 'connected' || accountCount === 0}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  {uploading ? 'Processing...' : 'Upload Deal Data'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Disable uploads if database not ready */}
        {dbConnectionStatus === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Uploads are disabled due to database connection issues. Please resolve the issues above before uploading.
            </AlertDescription>
          </Alert>
        )}

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
    </div>
  );
}
