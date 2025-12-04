import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileCheck, Info, Sparkles, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { formatNumber } from "@/utils/format-numbers";
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
  const navigate = useNavigate();
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
  const [showAdvanced, setShowAdvanced] = useState(() => {
    const saved = localStorage.getItem('showAdvancedDataUpload');
    return saved === 'true';
  });
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
      
      // Smart auto-mapping with common variations
      const autoMapping: FieldMapping = {};
      const expectedFields = LEADS_HEADERS;
      
      headers.forEach(header => {
        const normalized = header.toLowerCase().trim();
        
        // Company name variations
        if (normalized.match(/^(company|company_name|account|account_name)$/)) {
          autoMapping[header] = 'company';
        }
        // Email variations
        else if (normalized.match(/^(email|email_address|contact_email|e-mail)$/)) {
          autoMapping[header] = 'email';
        }
        // First name variations
        else if (normalized.match(/^(first_name|firstname|fname|first|given_name)$/)) {
          autoMapping[header] = 'first_name';
        }
        // Last name variations
        else if (normalized.match(/^(last_name|lastname|lname|last|surname|family_name)$/)) {
          autoMapping[header] = 'last_name';
        }
        // Title variations
        else if (normalized.match(/^(title|job_title|position|role)$/)) {
          autoMapping[header] = 'title';
        }
        // Other common fields
        else if (expectedFields.includes(normalized)) {
          autoMapping[header] = normalized;
        }
      });
      
      // Calculate mapping confidence (percentage of expected fields mapped)
      const mappedCount = Object.keys(autoMapping).length;
      const confidence = (mappedCount / Math.min(expectedFields.length, headers.length)) * 100;
      
      console.log(`Auto-mapping confidence: ${confidence.toFixed(0)}%`, autoMapping);
      
      // If high confidence (>80%), proceed directly. Otherwise show mapping dialog
      if (confidence > 80 && !showAdvanced) {
        handleFileUpload(autoMapping);
      } else {
        setCsvHeaders(headers);
        setSampleData(sampleRows);
        setPendingFile({ file, type, isExternalDatabase: isExternal });
        setShowFieldMapping(true);
      }
      
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

      // Matching is now handled by bulk-upload edge function automatically
      // Just show completion message
      setUploadProgress(100);
      
      toast({
        title: "✓ Upload & Matching Complete!",
        description: `${insertedLeads} leads uploaded and automatically linked to accounts.`,
        duration: 6000,
      });

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

  // Re-run matching is now handled by BulkLeadMatcher component
  // This function is no longer needed but kept for backwards compatibility
  const handleRerunMatching = async () => {
    // Matching is now done via BulkLeadMatcher component which processes in batches
    await loadTotalRecords();
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

      {/* Quick Start Section - Only show if no data yet */}
      {totalRecords === 0 && (
        <Card className="bg-gradient-to-br from-primary/5 via-secondary/5 to-background border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              🚀 Quick Start: Upload Your First Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get started in under 2 minutes. Download our sample CSV template with example data, then upload your own leads.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => downloadTemplate('leads')}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Sample CSV
              </Button>
              
              <Button 
                onClick={() => document.getElementById('quick-upload-input')?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </Button>
              
              <input
                id="quick-upload-input"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) analyzeCSVStructure(file, 'leads', false);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {uploadProgress < 10 && "📁 Reading CSV..."}
                  {uploadProgress >= 10 && uploadProgress < 20 && "🔍 Analyzing data..."}
                  {uploadProgress >= 20 && uploadProgress < 80 && "💾 Uploading leads..."}
                  {uploadProgress >= 80 && uploadProgress < 90 && "🔗 Matching to accounts..."}
                  {uploadProgress >= 90 && uploadProgress < 100 && "🎯 Scoring accounts..."}
                  {uploadProgress === 100 && "✅ Complete!"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success message with ICP CTA */}
      {uploadResult && uploadResult.errors.length === 0 && (
        <Alert className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary">
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <div>
              <strong>Great start!</strong> Your data is ready. Next step: Create your first ICP profile to identify your best-fit accounts.
            </div>
            <Button 
              onClick={() => navigate('/icp-manager')}
              variant="default"
              size="sm"
            >
              Create ICP →
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
      {unlinkedLeads > 0 && !showAdvanced && (
        <BulkLeadMatcher 
          unlinkedLeads={unlinkedLeads} 
          onComplete={loadTotalRecords}
        />
      )}

      {/* Advanced Settings Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="advanced-upload-toggle" className="text-base font-semibold">
                Advanced Upload Options
              </Label>
              <p className="text-sm text-muted-foreground">
                Show external database connections, field mapping, and advanced tools
              </p>
            </div>
            <Switch
              id="advanced-upload-toggle"
              checked={showAdvanced}
              onCheckedChange={(checked) => {
                setShowAdvanced(checked);
                localStorage.setItem('showAdvancedDataUpload', checked.toString());
              }}
            />
          </div>
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                🔓 Advanced Options Enabled
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdvanced && (
        <>
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

        </>
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
