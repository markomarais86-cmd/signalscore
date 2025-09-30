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
    return tabParam === 'closed-won' ? 'closed-won' : 'accounts';
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'accounts' | 'contacts' | 'leads' } | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
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
    
    const [accountsRes, contactsRes] = await Promise.all([
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', userProfile.org_id),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', userProfile.org_id)
    ]);

    setTotalRecords((accountsRes.count || 0) + (contactsRes.count || 0));
  };

  const analyzeCSVStructure = async (file: File, type: 'accounts' | 'contacts' | 'leads') => {
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
      setPendingFile({ file, type });
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
    console.log('🚀 Starting upload process', { type: pendingFile?.type, orgId: userProfile?.org_id });
    
    if (!pendingFile || !userProfile?.org_id) {
      const errorMsg = !pendingFile ? "No file selected" : "User profile not loaded";
      console.error('❌ Upload validation failed:', errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    setShowFieldMapping(false);

    try {
      console.log('📄 Reading file:', pendingFile.file.name);
      const text = await pendingFile.file.text();
      const rawData = parseCSV(text);
      console.log('✅ Parsed CSV data:', { rows: rawData.length, type: pendingFile.type });
      
      setUploadProgress(25);

      console.log('🔍 Validating data with mapping...');
      const validation = validateDataWithMapping(rawData, mapping, pendingFile.type);
      console.log('✅ Validation complete:', { 
        total: validation.total, 
        valid: validation.valid, 
        errors: validation.errors,
        warnings: validation.warnings 
      });
      setUploadProgress(50);

      // Helper function to convert employee count to range
      const getEmployeeRange = (count: number): string => {
        if (count < 50) return '1-49';
        if (count < 100) return '50-99';
        if (count < 250) return '100-249';
        if (count < 500) return '250-499';
        if (count < 1000) return '500-999';
        if (count < 2500) return '1000-2499';
        if (count < 5000) return '2500-4999';
        if (count < 10000) return '5000-9999';
        return '10000+';
      };

      // Helper function to convert revenue to range
      const getRevenueRange = (revenue: number): string => {
        if (revenue < 1000000) return '<$1M';
        if (revenue < 5000000) return '$1M-$5M';
        if (revenue < 10000000) return '$5M-$10M';
        if (revenue < 25000000) return '$10M-$25M';
        if (revenue < 50000000) return '$25M-$50M';
        if (revenue < 100000000) return '$50M-$100M';
        if (revenue < 250000000) return '$100M-$250M';
        if (revenue < 500000000) return '$250M-$500M';
        if (revenue < 1000000000) return '$500M-$1B';
        if (revenue < 10000000000) return '$1B-$10B';
        return '$10B+';
      };

      // Transform data using mapping
      const transformedData = rawData.map(row => {
        const transformed: any = { org_id: userProfile.org_id };
        
        Object.entries(mapping).forEach(([csvField, schemaField]: [string, string]) => {
          if (schemaField && row[csvField] !== undefined) {
            let value = row[csvField];
            
            if (schemaField === 'employee_count' && value) {
              const num = parseInt(value);
              value = isNaN(num) ? null : num;
            }
            
            transformed[schemaField] = value || null;
          }
        });
        
        // Auto-populate employee_range from employee_count for accounts only
        if (pendingFile.type === 'accounts' && !transformed.employee_range && transformed.employee_count) {
          transformed.employee_range = getEmployeeRange(transformed.employee_count);
        }
        
        // Auto-populate revenue_range from revenue if missing (for accounts and leads)
        if (!transformed.revenue_range) {
          // Try to find any revenue-related field in the raw row
          const revenueFields = ['revenue', 'annual_revenue', 'annual_revenue_number'];
          for (const field of revenueFields) {
            const revenueValue = row[field];
            if (revenueValue) {
              const num = parseFloat(String(revenueValue).replace(/[^0-9.]/g, ''));
              if (!isNaN(num) && num > 0) {
                transformed.revenue_range = getRevenueRange(num);
                break;
              }
            }
          }
        }
        
        // Add updated_at only for accounts and contacts (not for leads)
        if (pendingFile.type !== 'leads') {
          transformed.updated_at = new Date().toISOString();
        }
        
        // For leads, ensure name and status fields
        if (pendingFile.type === 'leads') {
          if (!transformed.name) {
            const firstName = transformed.first_name || '';
            const lastName = transformed.last_name || '';
            transformed.name = `${firstName} ${lastName}`.trim() || null;
          }
          if (!transformed.status) {
            transformed.status = 'open';
          }
        }
        
        return transformed;
      });

      // Filter out rows with errors
      const validData = transformedData.filter((_, index) => {
        const rowIssues = validation.issues.filter(issue => issue.row === index + 2);
        return !rowIssues.some(issue => issue.type === 'error');
      });
      
      console.log('✅ Filtered data:', { 
        totalRows: transformedData.length, 
        validRows: validData.length,
        rejectedRows: transformedData.length - validData.length 
      });

      setUploadProgress(75);

      let inserted = 0;

      if (validData.length > 0) {
        const tableName = pendingFile.type === 'accounts' ? 'accounts' : 
                         pendingFile.type === 'contacts' ? 'contacts' : 'Leads';
        
        console.log('💾 Upserting to database:', { table: tableName, records: validData.length });
        console.log('📊 Sample record:', validData[0]);
        
        const { data: upsertData, error: upsertError } = await supabase
          .from(tableName)
          .upsert(validData, { 
            onConflict: pendingFile.type === 'leads' ? 'org_id,external_id' : 'org_id,external_id'
          })
          .select();

        if (upsertError) {
          console.error('❌ Database upsert error:', {
            message: upsertError.message,
            code: upsertError.code,
            details: upsertError.details,
            hint: upsertError.hint
          });
          
          // Provide specific error message for column errors
          let errorMessage = upsertError.message;
          if (upsertError.message?.includes('column') && upsertError.message?.includes('does not exist')) {
            errorMessage = `Database schema error: ${upsertError.message}. Please check that your CSV fields match the database columns.`;
          }
          
          throw new Error(errorMessage);
        }
        
        inserted = validData.length;
        console.log('✅ Successfully inserted/updated records:', inserted);
      } else {
        console.warn('⚠️ No valid data to upload after filtering');
      }

      // Create sync job record
      console.log('📝 Creating sync job record...');
      const { error: syncError } = await supabase
        .from('sync_jobs')
        .insert({
          org_id: userProfile.org_id,
          source_system: 'csv_upload',
          job_type: pendingFile.type,
          received: rawData.length,
          inserted,
          updated: 0,
          rejected: validation.errors,
          status: 'completed',
          finished_at: new Date().toISOString()
        });
      
      if (syncError) {
        console.error('⚠️ Failed to create sync job record (non-fatal):', syncError);
      }

      setUploadProgress(100);

      const result = {
        total: rawData.length,
        inserted,
        updated: 0,
        rejected: validation.errors,
        errors: validation.issues.filter(i => i.type === 'error').map(i => i.message)
      };
      
      console.log('🎉 Upload complete:', result);
      setUploadResult(result);

      toast({
        title: "Upload completed",
        description: `Processed ${rawData.length} rows, imported ${inserted} valid records`,
        variant: inserted > 0 ? "default" : "destructive"
      });

      await loadTotalRecords();
      completeStep('upload_data');

    } catch (error: any) {
      console.error('❌ Upload error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });
      
      let errorMessage = "Unable to save your data. Please check your file format and try again.";
      let errorTitle = "Data Upload Failed";
      
      if (error.message?.includes('duplicate key')) {
        errorMessage = "Some records already exist. Data was updated where possible.";
        errorTitle = "Partial Upload";
      } else if (error.message?.includes('foreign key')) {
        errorMessage = "Some records reference accounts that don't exist. Make sure to upload accounts before contacts.";
      } else if (error.message?.includes('permission denied') || error.message?.includes('JWT')) {
        errorMessage = "You don't have permission to upload data. Please contact your administrator.";
      } else if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        errorMessage = `Database column error: ${error.message}. Please contact support.`;
      } else if (error.code) {
        errorMessage = `Database error (${error.code}): ${error.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.log('📢 Showing error to user:', { errorTitle, errorMessage });
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 10000
      });
      
      const errorResult = {
        total: 0,
        inserted: 0,
        updated: 0,
        rejected: 0,
        errors: [errorMessage]
      };
      
      console.log('Setting error result:', errorResult);
      setUploadResult(errorResult);
    } finally {
      console.log('🏁 Upload process finished');
      setUploading(false);
      setPendingFile(null);
    }
  };

  const downloadTemplate = (type: 'accounts' | 'contacts' | 'leads') => {
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
        <p className="text-muted-foreground mt-2">Import your accounts and contacts data via CSV</p>
      </div>

      {totalRecords > 0 && (
        <HeroMetric
          label="Records Processed"
          value={totalRecords}
          subtitle="Total accounts + contacts uploaded"
          icon={Database}
          trend={uploadResult ? { value: 15, period: 'this session' } : undefined}
          status={uploadResult?.errors?.length === 0 ? 'success' : 'default'}
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
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="closed-won">Closed Won</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
          <UploadSection
            type="accounts"
            headers={ACCOUNTS_HEADERS}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadResult={uploadResult}
            onFileSelect={(file) => analyzeCSVStructure(file, 'accounts')}
            onDownloadTemplate={() => downloadTemplate('accounts')}
            onDownloadRejections={downloadRejections}
          />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <UploadSection
            type="contacts"
            headers={CONTACTS_HEADERS}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadResult={uploadResult}
            onFileSelect={(file) => analyzeCSVStructure(file, 'contacts')}
            onDownloadTemplate={() => downloadTemplate('contacts')}
            onDownloadRejections={downloadRejections}
          />
        </TabsContent>

        <TabsContent value="leads" className="space-y-6">
          <UploadSection
            type="leads"
            headers={['external_id', 'first_name', 'last_name', 'email', 'phone', 'mobile', 'title', 'company', 'website', 'industry', 'revenue_range', 'employee_count', 'country', 'state_province', 'status']}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadResult={uploadResult}
            onFileSelect={(file) => analyzeCSVStructure(file, 'leads')}
            onDownloadTemplate={() => downloadTemplate('leads')}
            onDownloadRejections={downloadRejections}
          />
        </TabsContent>

        <TabsContent value="closed-won" className="space-y-6">
          <ClosedWonUpload />
        </TabsContent>
      </Tabs>

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
        dataType={pendingFile?.type || 'accounts'}
        sampleData={sampleData}
      />
    </div>
  );
}
