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
    if (!pendingFile || !userProfile?.org_id) {
      toast({ title: "Error", description: "No file selected or user profile not loaded", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    setShowFieldMapping(false);

    try {
      const text = await pendingFile.file.text();
      const rawData = parseCSV(text);
      
      setUploadProgress(25);

      const validation = validateDataWithMapping(rawData, mapping, pendingFile.type);
      setUploadProgress(50);

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
        
        transformed.updated_at = new Date().toISOString();
        return transformed;
      });

      // Filter out rows with errors
      const validData = transformedData.filter((_, index) => {
        const rowIssues = validation.issues.filter(issue => issue.row === index + 2);
        return !rowIssues.some(issue => issue.type === 'error');
      });

      setUploadProgress(75);

      let inserted = 0;

      if (validData.length > 0) {
        const tableName = pendingFile.type === 'accounts' ? 'accounts' : 
                         pendingFile.type === 'contacts' ? 'contacts' : 'Leads';
        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(validData, { 
            onConflict: pendingFile.type === 'leads' ? 'org_id,external_id' : 'org_id,external_id'
          });

        if (upsertError) throw upsertError;
        inserted = validData.length;
      }

      // Create sync job record
      await supabase
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

      setUploadProgress(100);

      setUploadResult({
        total: rawData.length,
        inserted,
        updated: 0,
        rejected: validation.errors,
        errors: validation.issues.filter(i => i.type === 'error').map(i => i.message)
      });

      toast({
        title: "Upload completed",
        description: `Processed ${rawData.length} rows, imported ${inserted} valid records`
      });

      await loadTotalRecords();
      completeStep('upload_data');

    } catch (error: any) {
      console.error('Upload error:', error);
      
      let errorMessage = "Unable to save your data. Please check your file format and try again.";
      let errorTitle = "Data Upload Failed";
      
      if (error.message?.includes('duplicate key')) {
        errorMessage = "Some records already exist. Data was updated where possible.";
        errorTitle = "Partial Upload";
      } else if (error.message?.includes('foreign key')) {
        errorMessage = "Some records reference accounts that don't exist. Make sure to upload accounts before contacts.";
      } else if (error.message?.includes('permission denied') || error.message?.includes('JWT')) {
        errorMessage = "You don't have permission to upload data. Please contact your administrator.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
      
      setUploadResult({
        total: 0,
        inserted: 0,
        updated: 0,
        rejected: 0,
        errors: [errorMessage]
      });
    } finally {
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
