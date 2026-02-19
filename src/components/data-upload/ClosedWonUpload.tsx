import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Download, Info, CheckCircle, AlertCircle, Zap, ListChecks, Database, HelpCircle, RefreshCw, FileQuestion, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV } from "@/utils/csv-parser";
import { normalizeDomain, createNormalizedDomainMap } from "@/utils/domain-normalizer";
import { SampleDataGenerator } from "@/components/SampleDataGenerator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { uploadLogger } from "@/lib/logger";
import { useRoles } from "@/hooks/use-roles";
import { useQuery } from "@tanstack/react-query";

// CSV headers for different modes
const EASY_MODE_HEADERS = ['domain'];
const DETAILED_MODE_HEADERS = ['account_external_id', 'deal_value', 'close_date', 'sales_cycle_days'];

// Common domain column name variations (case-insensitive)
const DOMAIN_COLUMN_VARIATIONS = ['domain', 'website', 'url', 'company_domain', 'company_website', 'site'];

// Helper function to find the domain column name in the CSV data
function findDomainColumn(row: any): string | null {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const key of keys) {
    const lowerKey = key.toLowerCase().trim();
    if (DOMAIN_COLUMN_VARIATIONS.includes(lowerKey)) {
      return key; // Return the actual key name (with original casing)
    }
  }
  return null;
}

interface UploadResult {
  total: number;
  inserted: number;
  rejected: number;
  errors: string[];
  accountsCreated?: number;
  accountsMatched?: number;
}

interface ClosedWonUploadProps {
  /** Override org ID for admin uploads to child orgs */
  targetOrgId?: string;
}

export function ClosedWonUpload({ targetOrgId }: ClosedWonUploadProps = {}) {
  const [uploadMode, setUploadMode] = useState<'easy' | 'detailed'>('easy');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'checking' | 'connected' | 'error' | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(targetOrgId || null);
  const fileRefEasy = useRef<HTMLInputElement>(null);
  const fileRefDetailed = useRef<HTMLInputElement>(null);
  const { userProfile, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { isSuperAdmin } = useRoles();

  // For super admins: fetch all child orgs to allow per-customer uploads
  const { data: childOrgs } = useQuery({
    queryKey: ['child-orgs-for-upload'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, parent_org_id')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin && !targetOrgId,
  });

  // The effective org for uploads: selected child org > targetOrgId prop > user's own org
  const uploadOrgId = selectedOrgId || targetOrgId || userProfile?.org_id;

  // Resolve the data org (parent) for account lookups
  const { data: resolvedDataOrgId } = useQuery({
    queryKey: ['upload-data-org', uploadOrgId],
    queryFn: async () => {
      if (!uploadOrgId) return null;
      const { data } = await supabase
        .from('organizations')
        .select('parent_org_id')
        .eq('id', uploadOrgId)
        .single();
      return (data as any)?.parent_org_id || uploadOrgId;
    },
    enabled: !!uploadOrgId,
  });

  const accountQueryOrgId = resolvedDataOrgId || uploadOrgId;

  // Check database connection and prerequisites on mount
  useEffect(() => {
    checkDatabaseConnection();
  }, [uploadOrgId]);

  const checkDatabaseConnection = async () => {
    uploadLogger.debug('Checking DB connection. Auth loading:', authLoading, 'User:', !!user, 'Profile:', !!userProfile, 'Upload Org:', uploadOrgId);
    
    if (!uploadOrgId) {
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
        .eq('org_id', accountQueryOrgId)
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
        .eq('org_id', accountQueryOrgId);

      setAccountCount(count || 0);
      setDbConnectionStatus('connected');
      setDbError(null);
    } catch (error: any) {
      uploadLogger.error('Database connection check failed:', error);
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
    uploadLogger.debug('handleFileSelect called with file:', file.name, 'mode:', mode);
    
    // Reset previous upload result
    setUploadResult(null);
    
    if (!uploadOrgId) {
      uploadLogger.warn('No org_id found');
      toast({
        title: "Error",
        description: "User profile not loaded",
        variant: "destructive"
      });
      return;
    }
    
    // Show starting toast
    toast({
      title: "Upload started",
      description: `Processing ${file.name}...`
    });

    uploadLogger.debug('Starting upload for org:', uploadOrgId);
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const text = await file.text();
      uploadLogger.debug('File read, parsing CSV...');
      const rawData = parseCSV(text);
      uploadLogger.debug('Parsed rows:', rawData.length);
      
      setUploadProgress(25);

      let transformedData: any[] = [];
      let rejectedCount = 0;
      let accountsCreated = 0;
      let accountsMatched = 0;

      if (mode === 'easy') {
        // Easy mode: Match domains to existing accounts using normalized domain matching
        // If no match found, automatically create a new account record
        // Firmographics will be automatically pulled from the accounts table during analysis
        
        // Find the domain column name
        const domainColumnName = rawData.length > 0 ? findDomainColumn(rawData[0]) : null;
        
        if (!domainColumnName) {
          throw new Error(`No domain column found. Expected one of: ${DOMAIN_COLUMN_VARIATIONS.join(', ')}. Found columns: ${rawData.length > 0 ? Object.keys(rawData[0]).join(', ') : 'none'}`);
        }
        
        uploadLogger.debug('Using column name:', domainColumnName);
        
        const normalizedDomains = rawData
          .map(row => normalizeDomain(row[domainColumnName]))
          .filter(Boolean);
        uploadLogger.debug('Processing normalized domains:', normalizedDomains);
        
        // Fetch ALL accounts for this org (we'll normalize and match in-memory)
        const { data: accounts, error: accountError } = await supabase
          .from('accounts')
          .select('external_id, domain')
          .eq('org_id', accountQueryOrgId)
          .not('domain', 'is', null);

        if (accountError) throw accountError;
        uploadLogger.debug('Found accounts:', accounts?.length);

        setUploadProgress(40);

        // Create a map of normalized domain to account_external_id
        const domainMap = createNormalizedDomainMap(accounts || []);
        uploadLogger.debug('Created normalized domain map with', domainMap.size, 'entries');
        uploadLogger.debug('Domain map entries (first 5):', Array.from(domainMap.entries()).slice(0, 5));

        // Helper function to derive company name from domain
        const deriveCompanyName = (domain: string): string => {
          // Remove TLD and clean up
          const cleaned = domain.split('.')[0];
          // Capitalize first letter
          return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        };

        // Separate matched and unmatched domains
        const matchedRows: any[] = [];
        const unmatchedRows: any[] = [];
        
        for (const row of rawData) {
          const originalDomain = row[domainColumnName];
          const normalizedDomain = normalizeDomain(originalDomain);
          
          
          if (normalizedDomain && domainMap.has(normalizedDomain)) {
            matchedRows.push({ row, normalizedDomain, accountExternalId: domainMap.get(normalizedDomain) });
          } else if (normalizedDomain) {
            unmatchedRows.push({ row, normalizedDomain, originalDomain });
          } else {
            rejectedCount++;
          }
        }

        uploadLogger.debug('Matched:', matchedRows.length, 'Unmatched:', unmatchedRows.length, 'Rejected:', rejectedCount);

        setUploadProgress(50);

        // Create new accounts for unmatched domains
        const newAccountsToCreate = unmatchedRows.map(({ normalizedDomain, originalDomain }) => ({
          org_id: accountQueryOrgId!,
          external_id: `CW_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          domain: normalizedDomain,
          name: deriveCompanyName(normalizedDomain),
          data_source: 'closed_won'
        }));

        if (newAccountsToCreate.length > 0) {
          uploadLogger.debug('Creating', newAccountsToCreate.length, 'new accounts');
          const { data: createdAccounts, error: createError } = await supabase
            .from('accounts')
            .insert(newAccountsToCreate)
            .select('external_id, domain');

          if (createError) {
            uploadLogger.error('Error creating accounts:', createError);
            throw new Error(`Failed to create new accounts: ${createError.message}`);
          } else if (createdAccounts) {
            accountsCreated = createdAccounts.length;
            uploadLogger.debug('Successfully created', accountsCreated, 'accounts');
            
            // Add created accounts to the domain map
            for (const account of createdAccounts) {
              const normalized = normalizeDomain(account.domain);
              if (normalized) {
                domainMap.set(normalized, account.external_id);
              }
            }
          }
        }

        setUploadProgress(70);

        // Count accountsMatched before transformation
        accountsMatched = matchedRows.length;
        
        // Now transform all data (both matched and newly created)
        const today = new Date().toISOString().split('T')[0];
        const allRows = [...matchedRows, ...unmatchedRows];
        
        transformedData = allRows
          .map((item) => {
            const hasMatch = item.normalizedDomain && domainMap.has(item.normalizedDomain);
            
            if (!hasMatch) {
              uploadLogger.warn('No match found for domain:', item.normalizedDomain);
              return null;
            }
            
            return {
              org_id: uploadOrgId!,
              account_external_id: domainMap.get(item.normalizedDomain),
              deal_value: 0,
              close_date: today,
              sales_cycle_days: null
            };
          })
          .filter(Boolean); // Remove nulls

        uploadLogger.debug('Final transformed data:', transformedData.length, 'records. Matched:', accountsMatched, 'Created:', accountsCreated);
      } else {
        // Detailed mode: Use provided data
        const validData = rawData.filter(row => {
          return row.account_external_id && row.deal_value && row.close_date;
        });

        rejectedCount = rawData.length - validData.length;
        setUploadProgress(50);

        transformedData = validData.map(row => ({
          org_id: uploadOrgId!,
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
        accountsCreated,
        accountsMatched,
        errors: rejectedCount > 0 
          ? mode === 'easy'
            ? [`${rejectedCount} domains were invalid or missing`]
            : [`${rejectedCount} rows missing required fields`]
          : []
      });

      toast({
        title: "Upload completed",
        description: `Processed ${transformedData.length} closed won deals`
      });

    } catch (error: any) {
      uploadLogger.error('Upload error:', error);
      
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
        {/* Super Admin: Org Selector for per-customer uploads */}
        {isSuperAdmin && !targetOrgId && childOrgs && childOrgs.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Upload For Organization
            </label>
            <Select
              value={selectedOrgId || ''}
              onValueChange={(val) => setSelectedOrgId(val || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer organization..." />
              </SelectTrigger>
              <SelectContent>
                {childOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} {org.parent_org_id ? '(Managed)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOrgId && selectedOrgId !== userProfile?.org_id && (
              <p className="text-xs text-muted-foreground">
                Closed-won deals will be uploaded to this customer's organization.
              </p>
            )}
          </div>
        )}
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
                  title={
                    !userProfile ? "Loading user profile..." :
                    dbConnectionStatus !== 'connected' ? "Database not connected" :
                    accountCount === 0 ? "Please upload accounts first" :
                    uploading ? "Processing..." : "Click to upload"
                  }
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
                  title={
                    !userProfile ? "Loading user profile..." :
                    dbConnectionStatus !== 'connected' ? "Database not connected" :
                    accountCount === 0 ? "Please upload accounts first" :
                    uploading ? "Processing..." : "Click to upload"
                  }
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
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-low))]">{uploadResult.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>

            {/* Enhanced Domain Matching Summary */}
            {uploadMode === 'easy' && (uploadResult.accountsMatched || uploadResult.accountsCreated) && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Domain Matching Results:</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {uploadResult.accountsMatched ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-[hsl(var(--signal-high))]" />
                          <span className="text-sm">{uploadResult.accountsMatched} matched to existing accounts</span>
                        </div>
                      ) : null}
                      {uploadResult.accountsCreated ? (
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          <span className="text-sm">{uploadResult.accountsCreated} new accounts created</span>
                        </div>
                      ) : null}
                    </div>
                    {uploadResult.accountsCreated > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        New accounts were automatically created for unmatched domains. You can enrich them with additional data from Settings → Integrations.
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

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

            {uploadResult.inserted > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-[hsl(var(--signal-high))]" />
                    What's Next?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your closed won data has been uploaded. Here's what you can do now:
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <span className="text-sm font-bold text-primary">1</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">Generate ICP Recommendations</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Analyze your closed won deals to discover patterns and create ideal customer profiles
                        </p>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => window.location.href = '/icp-manager'}
                        >
                          <Trophy className="h-4 w-4 mr-2" />
                          Go to ICP Manager
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <span className="text-sm font-bold text-primary">2</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">View Analysis Dashboard</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          See detailed breakdown of your closed won accounts by industry, size, and geography
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.location.href = '/icp-tam-intelligence'}
                        >
                          <Database className="h-4 w-4 mr-2" />
                          View ICP Analysis
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <span className="text-sm font-bold text-primary">3</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">Score Your Accounts</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Once you create an ICP, score all your accounts to prioritize your pipeline
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.location.href = '/accounts'}
                        >
                          <ListChecks className="h-4 w-4 mr-2" />
                          View Accounts
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
