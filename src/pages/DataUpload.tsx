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
    let insertedAccounts = 0;
    let insertedContacts = 0;
    let totalProcessed = 0;
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
      const validation = validateDataWithMapping(rawData, mapping, pendingFile.type);
      console.log(`✅ Validation: ${validation.valid} valid, ${validation.errors} errors`);
      
      setUploadProgress(20);

      if (pendingFile.type === 'leads') {
        // SEQUENTIAL UPLOAD: accounts → contacts → leads
        console.log('🔄 Starting sequential upload for leads...');
        
        // Create reverse mapping: dbField -> csvColumn
        const reverseMapping: Record<string, string> = {};
        Object.entries(mapping).forEach(([csvCol, dbField]) => {
          if (dbField) reverseMapping[dbField] = csvCol;
        });
        
        const batchSize = 100;
        
        for (let i = 0; i < rawData.length; i += batchSize) {
          const batch = rawData.slice(i, Math.min(i + batchSize, rawData.length));
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: rows ${i + 1} to ${i + batch.length}`);

          // STEP 1: Insert Accounts
          const accountsData = batch.map((row, idx) => {
            const accountId = `acc_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`;
            
            return {
              org_id: orgId,
              external_id: accountId,
              name: (reverseMapping.company && row[reverseMapping.company]) || 'Unknown Company',
              domain: (reverseMapping.website && row[reverseMapping.website]) || null,
              industry_raw: (reverseMapping.industry && row[reverseMapping.industry]) || null,
              industry_norm: (reverseMapping.industry && row[reverseMapping.industry]) || null,
              employee_count: (reverseMapping.employee_count && row[reverseMapping.employee_count]) ? parseInt(row[reverseMapping.employee_count]) : null,
              revenue_range: (reverseMapping.revenue_range && row[reverseMapping.revenue_range]) || null,
              country: (reverseMapping.country && row[reverseMapping.country]) || null,
              state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
              phone: (reverseMapping.phone && row[reverseMapping.phone]) || null,
              data_source: 'crm',
              updated_at: new Date().toISOString()
            };
          });

          console.log(`📤 Inserting ${accountsData.length} accounts...`);
          const { data: accountsResult, error: accountsError } = await supabase
            .from('accounts')
            .upsert(accountsData, { onConflict: 'org_id,external_id' })
            .select('id, external_id');

          if (accountsError) {
            const msg = `Accounts failed: ${accountsError.message} | Code: ${accountsError.code} | Details: ${accountsError.details}`;
            console.error('❌ ACCOUNTS ERROR:', {
              message: accountsError.message,
              code: accountsError.code,
              details: accountsError.details,
              hint: accountsError.hint,
              sampleData: accountsData[0]
            });
            toast({ 
              title: "Accounts Upload Failed", 
              description: `${accountsError.message} (${accountsError.code})`,
              variant: "destructive",
              duration: 10000
            });
            errors.push(msg);
            continue; // Skip this batch
          }

          insertedAccounts += accountsResult?.length || 0;
          console.log(`✅ Inserted ${accountsResult?.length} accounts`);
          setUploadProgress(20 + Math.round((i / rawData.length) * 30));

          // STEP 2: Insert Contacts
          const contactsData = batch
            .filter((row) => 
              (reverseMapping.first_name && row[reverseMapping.first_name]) || 
              (reverseMapping.last_name && row[reverseMapping.last_name]) || 
              (reverseMapping.email && row[reverseMapping.email])
            )
            .map((row, idx) => ({
              org_id: orgId,
              external_id: `cont_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`,
              account_external_id: accountsData[idx].external_id,
              first_name: (reverseMapping.first_name && row[reverseMapping.first_name]) || null,
              last_name: (reverseMapping.last_name && row[reverseMapping.last_name]) || null,
              email: (reverseMapping.email && row[reverseMapping.email]) || null,
              title_raw: (reverseMapping.title && row[reverseMapping.title]) || null,
              mobile: (reverseMapping.mobile && row[reverseMapping.mobile]) || null,
              phone: (reverseMapping.phone && row[reverseMapping.phone]) || null,
              country: (reverseMapping.country && row[reverseMapping.country]) || null,
              state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
              data_source: 'crm',
              updated_at: new Date().toISOString()
            }));

          if (contactsData.length > 0) {
            console.log(`📤 Inserting ${contactsData.length} contacts...`);
            const { data: contactsResult, error: contactsError } = await supabase
              .from('contacts')
              .upsert(contactsData, { onConflict: 'org_id,external_id' })
              .select('id, external_id');

            if (contactsError) {
              const msg = `Contacts failed: ${contactsError.message}`;
              console.error('❌ CONTACTS ERROR:', {
                message: contactsError.message,
                code: contactsError.code,
                details: contactsError.details,
                sampleData: contactsData[0]
              });
              toast({ 
                title: "Contacts Upload Failed", 
                description: `${contactsError.message} (${contactsError.code})`,
                variant: "destructive",
                duration: 10000
              });
              errors.push(msg);
            } else {
              insertedContacts += contactsResult?.length || 0;
              console.log(`✅ Inserted ${contactsResult?.length} contacts`);
            }
          }

          setUploadProgress(50 + Math.round((i / rawData.length) * 30));

          // STEP 3: Insert Leads
          const leadsData = batch.map((row, idx) => {
            const firstName = reverseMapping.first_name && row[reverseMapping.first_name];
            const lastName = reverseMapping.last_name && row[reverseMapping.last_name];
            const company = reverseMapping.company && row[reverseMapping.company];
            const leadName = firstName && lastName ? `${firstName} ${lastName}` : company || 'Unknown Lead';

            return {
              org_id: orgId,
              external_id: (reverseMapping.external_id && row[reverseMapping.external_id]) || `lead_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`,
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
              last_name: lastName || null,
              account_external_id: accountsData[idx].external_id,
              contact_external_id: contactsData[idx]?.external_id || null
            };
          });

          console.log(`📤 Inserting ${leadsData.length} leads...`);
          const { data: leadsResult, error: leadsError } = await supabase
            .from('Leads')
            .upsert(leadsData, { onConflict: 'org_id,external_id' })
            .select('id');

          if (leadsError) {
            const msg = `Leads failed: ${leadsError.message}`;
            console.error('❌ LEADS ERROR:', {
              message: leadsError.message,
              code: leadsError.code,
              details: leadsError.details,
              sampleData: leadsData[0]
            });
            toast({ 
              title: "Leads Upload Failed", 
              description: `${leadsError.message} (${leadsError.code})`,
              variant: "destructive",
              duration: 10000
            });
            errors.push(msg);
          } else {
            insertedLeads += leadsResult?.length || 0;
            console.log(`✅ Inserted ${leadsResult?.length} leads`);
          }

          totalProcessed += batch.length;
          setUploadProgress(80 + Math.round((i / rawData.length) * 20));
        }

        toast({
          title: "Upload Complete!",
          description: `Uploaded ${insertedLeads} leads, ${insertedAccounts} accounts, ${insertedContacts} contacts`,
        });

      } else {
        // Single table upload for accounts/contacts
        const tableName = pendingFile.type === 'accounts' ? 'accounts' : 'contacts';
        
        const transformedData = rawData.map((row, idx) => {
          const transformed: any = { 
            org_id: orgId,
            data_source: 'crm',
            updated_at: new Date().toISOString()
          };
          
          Object.entries(mapping).forEach(([csvField, dbField]) => {
            if (dbField && row[csvField] !== undefined && row[csvField] !== '') {
              transformed[dbField] = row[csvField];
            }
          });

          if (!transformed.external_id) {
            transformed.external_id = `${tableName.substring(0, 3)}_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`;
          }
          
          return transformed;
        });

        console.log(`📤 Inserting ${transformedData.length} ${tableName}...`);
        const { data: result, error } = await supabase
          .from(tableName)
          .upsert(transformedData, { onConflict: 'org_id,external_id' })
          .select();

        if (error) {
          throw new Error(`${tableName} upload failed: ${error.message}`);
        }

        totalProcessed = result?.length || 0;
        console.log(`✅ Inserted ${totalProcessed} ${tableName}`);
        
        toast({
          title: "Upload Complete!",
          description: `Uploaded ${totalProcessed} ${tableName}`,
        });
      }

      setUploadProgress(100);

      setUploadResult({
        total: rawData.length,
        inserted: pendingFile.type === 'leads' ? insertedLeads : totalProcessed,
        updated: 0,
        rejected: errors.length,
        errors
      });

      await loadTotalRecords();
      completeStep('upload_data');

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
