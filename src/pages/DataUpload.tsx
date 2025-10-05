import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileCheck, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { FieldMappingDialog, FieldMapping } from "@/components/data-upload/FieldMappingDialog";
import { DataValidationReport } from "@/components/data-upload/DataValidationReport";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { UploadSection } from "@/components/data-upload/UploadSection";
import { ClosedWonUpload } from "@/components/data-upload/ClosedWonUpload";
import { DataProcessingPipeline } from "@/components/data-upload/DataProcessingPipeline";
import { BulkLeadMatcher } from "@/components/data-upload/BulkLeadMatcher";
import { useCSVValidator } from "@/hooks/use-csv-validator";
import { parseCSV, ACCOUNTS_HEADERS, CONTACTS_HEADERS, LEADS_HEADERS, generateCSVTemplate } from "@/utils/csv-parser";

interface UploadResult {
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

export default function DataUpload() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam === 'closed-won' ? 'closed-won' : 'leads';
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'leads'; isExternalDatabase?: boolean } | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isExternalDatabase, setIsExternalDatabase] = useState(false);
  const [unlinkedLeads, setUnlinkedLeads] = useState(0);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();
  const { validationResult, validateDataWithMapping, setValidationResult } = useCSVValidator();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadTotalRecords();
    }
  }, [userProfile?.org_id]);

  const loadTotalRecords = async () => {
    if (!userProfile?.org_id) return;
    
    const leadsRes = await supabase
      .from('Leads')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', userProfile.org_id);

    const unlinkedRes = await supabase
      .from('Leads')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', userProfile.org_id)
      .is('account_external_id', null);

    setTotalRecords(leadsRes.count || 0);
    setUnlinkedLeads(unlinkedRes.count || 0);
  };

  const analyzeCSVStructure = async (file: File, type: 'leads', isExternal: boolean = false) => {
    try {
      const text = await file.text();
      const rawData = parseCSV(text);
      
      if (rawData.length === 0) {
        throw new Error("No data found in CSV file");
      }

      const headers = Object.keys(rawData[0]);
      const sampleRows = rawData.slice(0, 5);
      
      setCsvHeaders(headers);
      setSampleData(sampleRows);
      setPendingFile({ file, type, isExternalDatabase: isExternal });
      setShowFieldMapping(true);
      
    } catch (error: any) {
      console.error('Error analyzing CSV:', error);
      
      let errorMessage = "Unable to read the CSV file. Please check the file format and try again.";
      
      if (error.message?.includes('Invalid CSV')) {
        errorMessage = "The file appears to be corrupted or not a valid CSV file.";
      } else if (error.message?.includes('encoding')) {
        errorMessage = "File encoding not supported. Please save as UTF-8 and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "CSV Analysis Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (mapping: FieldMapping) => {
    if (!pendingFile || !userProfile?.org_id) {
      toast({
        title: "Upload Error",
        description: !pendingFile ? "No file selected" : "Authentication required",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    setShowFieldMapping(false);

    const orgId = userProfile.org_id;
    let insertedLeads = 0;
    const errors: string[] = [];

    try {
      // Parse CSV
      const text = await pendingFile.file.text();
      const rawData = parseCSV(text);
      console.log(`📊 Parsed ${rawData.length} rows from CSV`);
      
      if (rawData.length === 0) {
        throw new Error("No data found in CSV file");
      }

      setUploadProgress(10);

      // Validate data
      const validation = validateDataWithMapping(rawData, mapping, 'leads');
      console.log(`✅ Validation: ${validation.valid} valid, ${validation.errors} errors`);
      
      setUploadProgress(20);

      // Use edge function for large uploads (>5000 records)
      if (rawData.length > 5000) {
        console.log(`🚀 Using edge function for bulk upload of ${rawData.length} leads`);
        
        toast({
          title: "Large Upload Detected",
          description: `Processing ${rawData.length} leads in the background for optimal performance...`,
        });

        const { data, error } = await supabase.functions.invoke('bulk-upload', {
          body: {
            data: rawData,
            mapping: mapping,
            orgId: orgId,
            isExternalDatabase: pendingFile.isExternalDatabase || false
          }
        });

        if (error) throw error;

        insertedLeads = data.insertedLeads || 0;
        errors.push(...(data.errors || []));

        setUploadProgress(80);

        toast({
          title: "Upload Complete!",
          description: `Uploaded ${insertedLeads} leads. Now matching to accounts...`,
        });

      } else {
        // Optimized upload for smaller datasets
        console.log(`⚡ Starting upload for ${rawData.length} leads...`);
        
        // Create reverse mapping: dbField -> csvColumn
        const reverseMapping: Record<string, string> = {};
        Object.entries(mapping).forEach(([csvCol, dbField]) => {
          if (dbField) reverseMapping[dbField] = csvCol;
        });
        
        const batchSize = 1000;
        
        for (let i = 0; i < rawData.length; i += batchSize) {
          const batch = rawData.slice(i, Math.min(i + batchSize, rawData.length));
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: rows ${i + 1} to ${i + batch.length}`);

          // Deduplicate leads by external_id within this batch
          const leadsMap = new Map<string, any>();
          batch.forEach((row, idx) => {
            const firstName = reverseMapping.first_name && row[reverseMapping.first_name];
            const lastName = reverseMapping.last_name && row[reverseMapping.last_name];
            const company = reverseMapping.company && row[reverseMapping.company];
            const leadName = firstName && lastName ? `${firstName} ${lastName}` : company || 'Unknown Lead';
            
            const externalId = (reverseMapping.external_id && row[reverseMapping.external_id]) || `lead_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Only keep the first occurrence of each external_id
            if (!leadsMap.has(externalId)) {
              leadsMap.set(externalId, {
                org_id: orgId,
                external_id: externalId,
                name: leadName,
                status: (reverseMapping.status && row[reverseMapping.status]) || 'open',
                company: company || null,
                email: (reverseMapping.email && row[reverseMapping.email]) || null,
                phone: (reverseMapping.phone && row[reverseMapping.phone]) || null,
                mobile: (reverseMapping.mobile && row[reverseMapping.mobile]) || null,
                website: (reverseMapping.website && row[reverseMapping.website]) || null,
                industry: (reverseMapping.industry && row[reverseMapping.industry]) || null,
                revenue_range: (reverseMapping.revenue_range && row[reverseMapping.revenue_range]) || null,
                employee_count: (reverseMapping.employee_count && row[reverseMapping.employee_count]) ? parseInt(row[reverseMapping.employee_count]) : null,
                country: (reverseMapping.country && row[reverseMapping.country]) || null,
                state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
                title: (reverseMapping.title && row[reverseMapping.title]) || null,
                first_name: firstName || null,
                last_name: lastName || null
              });
            }
          });
          
          const leadsData = Array.from(leadsMap.values());

          // Insert leads
          const { data: result, error } = await supabase
            .from('Leads')
            .upsert(leadsData, { onConflict: 'org_id,external_id', ignoreDuplicates: false })
            .select('id');

          if (error) {
            console.error('❌ Leads error:', error);
            errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            insertedLeads += result?.length || 0;
            console.log(`✅ Inserted ${result?.length} leads`);
          }

          setUploadProgress(20 + Math.round((i / rawData.length) * 60));
        }

        toast({
          title: "Upload Complete!",
          description: `Uploaded ${insertedLeads} leads. Now matching to accounts...`,
        });
      }

      setUploadProgress(80);

      setUploadResult({
        total: rawData.length,
        inserted: insertedLeads,
        updated: 0,
        rejected: errors.length,
        errors
      });

      await loadTotalRecords();
      completeStep('upload_data');

      // Check auto-match setting
      const { data: autoMatchSetting } = await supabase
        .from('automation_settings')
        .select('enabled')
        .eq('org_id', orgId)
        .eq('setting_key', 'auto_match_on_upload')
        .single();

      const shouldAutoMatch = autoMatchSetting?.enabled ?? true;

      if (shouldAutoMatch) {
        console.log('🔄 Auto-matching leads to accounts...');
        toast({
          title: "Matching Leads to Accounts",
          description: "Creating account records and linking leads (disable in Settings > Automation)...",
        });

        try {
          const { data: matchData, error: matchError } = await supabase.rpc('match_leads_to_accounts_fast' as any, {
            p_org_id: orgId,
            p_is_external_db: pendingFile.isExternalDatabase || false
          });

          if (matchError) throw matchError;

          const result = matchData as any;
          console.log(`✅ Lead matching complete:`, result);

          setUploadProgress(100);

          const sourceType = pendingFile.isExternalDatabase ? 'external database' : 'CRM';
          toast({
            title: "✓ Auto-Matching & Scoring Complete!",
            description: `${result.total_linked.toLocaleString()} ${sourceType} leads linked to ${result.new_accounts_created.toLocaleString()} new + ${result.matched_to_existing.toLocaleString()} existing accounts${result.accounts_updated_to_both ? ` • ${result.accounts_updated_to_both} updated to BOTH` : ''} • ${result.accounts_scored || 0} scored`,
            duration: 8000,
          });

        } catch (matchError: any) {
          console.error('Auto-matching error:', matchError);
          toast({
            title: "Matching Failed",
            description: matchError.message || "Please try re-running the matching process",
            variant: "destructive"
          });
        }
      } else {
        setUploadProgress(100);
        toast({
          title: "Upload Complete",
          description: "Auto-matching is disabled. Enable it in Settings > Automation to link leads automatically.",
          duration: 6000,
        });
      }

    } catch (error: any) {
      console.error('❌ Upload error:', error);
      
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
        duration: 10000
      });

      setUploadResult({
        total: 0,
        inserted: 0,
        updated: 0,
        rejected: 1,
        errors: [error.message]
      });
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  const handleRerunMatching = async () => {
    console.log('🔄 Re-run button clicked!');
    console.log('User profile:', userProfile);
    
    if (!userProfile?.org_id) {
      console.error('❌ No org_id found');
      toast({
        title: "Error",
        description: "Authentication required",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting re-match for org:', userProfile.org_id);
      
      toast({
        title: "Re-running Matching & Scoring",
        description: "This may take a few minutes for large datasets...",
      });

      console.log('Calling match_leads_to_accounts_fast RPC...');
      const { data: matchData, error: matchError } = await supabase.rpc('match_leads_to_accounts_fast' as any, {
        p_org_id: userProfile.org_id,
        p_is_external_db: false // Re-match is always for CRM data
      });

      console.log('RPC response:', { matchData, matchError });

      if (matchError) {
        console.error('❌ RPC error:', matchError);
        throw matchError;
      }

      const result = matchData as any;
      console.log(`✅ Re-match complete:`, result);

      toast({
        title: "✓ Matching Complete!",
        description: `${result.total_linked.toLocaleString()} leads linked • ${result.new_accounts_created.toLocaleString()} new accounts • ${result.accounts_scored || 0} scored`,
        duration: 8000,
      });

      await loadTotalRecords();

    } catch (error: any) {
      console.error('❌ Re-match error:', error);
      toast({
        title: "Matching Failed",
        description: error.message || "An error occurred during matching",
        variant: "destructive",
        duration: 10000,
      });
    }
  };

  const downloadTemplate = (type: 'leads') => {
    const csvContent = generateCSVTemplate(type);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadRejections = () => {
    if (!uploadResult || uploadResult.errors.length === 0) return;

    const csvContent = 'Row,Error\n' + 
      uploadResult.errors.map(error => `"${error}"`).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'upload_rejections.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Data Upload</h1>
        <p className="text-muted-foreground mt-2">Import leads via CSV - accounts are automatically created, matched, and scored</p>
      </div>

      {totalRecords > 0 && (
        <HeroMetric
          label="Leads Uploaded"
          value={totalRecords}
          subtitle="Total leads in your database"
          icon={Database}
          trend={uploadResult ? { value: 15, period: 'this session' } : undefined}
          status={uploadResult?.errors?.length === 0 ? 'success' : 'default'}
        />
      )}

      {/* Lead Processing Status */}
      {unlinkedLeads > 0 && (
        <BulkLeadMatcher 
          unlinkedLeads={unlinkedLeads} 
          onComplete={loadTotalRecords}
        />
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>Quick Start:</strong> Download a template CSV with sample data to get started quickly.
          </div>
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="closed-won">Closed Won</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          <UploadSection
            type="leads"
            headers={['external_id', 'first_name', 'last_name', 'email', 'phone', 'mobile', 'title', 'company', 'website', 'industry', 'revenue_range', 'employee_count', 'country', 'state_province', 'status']}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadResult={uploadResult}
            onFileSelect={(file) => analyzeCSVStructure(file, 'leads', isExternalDatabase)}
            onDownloadTemplate={() => downloadTemplate('leads')}
            onDownloadRejections={downloadRejections}
            onRerunMatching={handleRerunMatching}
            isExternalDatabase={isExternalDatabase}
            onExternalDatabaseChange={setIsExternalDatabase}
          />
        </TabsContent>

        <TabsContent value="closed-won" className="space-y-6">
          <ClosedWonUpload />
        </TabsContent>
      </Tabs>

      <DataProcessingPipeline />

      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Data Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataValidationReport 
              result={validationResult}
              onDownloadReport={() => {
                const reportData = {
                  summary: {
                    total: validationResult.total,
                    valid: validationResult.valid,
                    warnings: validationResult.warnings,
                    errors: validationResult.errors
                  },
                  dataQuality: validationResult.dataQuality,
                  issues: validationResult.issues,
                  fieldAnalysis: validationResult.fieldAnalysis
                };
                
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `validation-report-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              }}
              onDownloadCleanData={() => {
                const cleanData = sampleData.filter((_, index) => {
                  const rowIssues = validationResult.issues.filter(issue => issue.row === index + 2);
                  return !rowIssues.some(issue => issue.type === 'error');
                });
                
                if (cleanData.length > 0) {
                  const headers = Object.keys(cleanData[0]);
                  const csvContent = [
                    headers.join(','),
                    ...cleanData.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
                  ].join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `clean-data-${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                }
              }}
              onDownloadErrors={() => {
                const errorReport = validationResult.issues.filter(issue => issue.type === 'error');
                const csvContent = [
                  'Row,Field,Error,Value,Suggestion',
                  ...errorReport.map(issue => 
                    `${issue.row},"${issue.field}","${issue.message}","${issue.value || ''}","${issue.suggestion || ''}"`
                  )
                ].join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `error-report-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              }}
            />
          </CardContent>
        </Card>
      )}

      <FieldMappingDialog
        isOpen={showFieldMapping}
        onClose={() => {
          setShowFieldMapping(false);
          setPendingFile(null);
        }}
        onConfirm={handleFileUpload}
        csvHeaders={csvHeaders}
        dataType={pendingFile?.type || 'leads'}
        sampleData={sampleData}
      />
    </div>
  );
}
