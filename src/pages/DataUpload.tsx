import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Download, CheckCircle, AlertCircle, Info, MapPin, Database, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { FieldMappingDialog, FieldMapping } from "@/components/data-upload/FieldMappingDialog";
import { DataValidationReport, ValidationResult, ValidationIssue, DataQualityScore, FieldAnalysis } from "@/components/data-upload/DataValidationReport";
import { HeroMetric } from "@/components/executive/HeroMetric";

interface UploadResult {
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

const ACCOUNTS_HEADERS = [
  "external_id (required)",
  "name",
  "domain", 
  "industry_raw",
  "employee_count",
  "revenue_range",
  "country"
];

const CONTACTS_HEADERS = [
  "external_id (required)",
  "account_external_id (required)",
  "first_name",
  "last_name", 
  "email",
  "title_raw",
  "country"
];

export default function DataUpload() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'accounts' | 'contacts' } | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const accountsFileRef = useRef<HTMLInputElement>(null);
  const contactsFileRef = useRef<HTMLInputElement>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

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

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });
      
      rows.push(row);
    }

    return rows;
  };

  const validateAccountsData = (data: any[]): { valid: any[], errors: string[] } => {
    const valid = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because we skip header and arrays are 0-indexed

      if (!row.external_id) {
        errors.push(`Row ${rowNum}: external_id is required`);
        continue;
      }

      // Convert employee_count to number if present
      if (row.employee_count) {
        const empCount = parseInt(row.employee_count);
        if (isNaN(empCount)) {
          errors.push(`Row ${rowNum}: employee_count must be a number`);
          continue;
        }
        row.employee_count = empCount;
      }

      valid.push({
        org_id: userProfile?.org_id,
        external_id: row.external_id,
        name: row.name || null,
        domain: row.domain || null,
        industry_raw: row.industry_raw || null,
        employee_count: row.employee_count || null,
        revenue_range: row.revenue_range || null,
        country: row.country || null,
        updated_at: new Date().toISOString()
      });
    }

    return { valid, errors };
  };

  const validateContactsData = (data: any[]): { valid: any[], errors: string[] } => {
    const valid = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      if (!row.external_id) {
        errors.push(`Row ${rowNum}: external_id is required`);
        continue;
      }

      if (!row.account_external_id) {
        errors.push(`Row ${rowNum}: account_external_id is required`);
        continue;
      }

      valid.push({
        org_id: userProfile?.org_id,
        external_id: row.external_id,
        account_external_id: row.account_external_id,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        email: row.email || null,
        title_raw: row.title_raw || null,
        country: row.country || null,
        updated_at: new Date().toISOString()
      });
    }

    return { valid, errors };
  };

  const detectDuplicates = (rawData: any[], mapping: FieldMapping, type: 'accounts' | 'contacts', issues: ValidationIssue[]): number => {
    const keyField = type === 'accounts' ? 'external_id' : 'external_id';
    const csvKeyField = Object.keys(mapping).find(key => mapping[key] === keyField);
    
    if (!csvKeyField) return 0;
    
    const seenValues = new Set<string>();
    let duplicateCount = 0;
    
    rawData.forEach((row, index) => {
      const keyValue = row[csvKeyField];
      if (keyValue) {
        if (seenValues.has(keyValue)) {
          duplicateCount++;
          issues.push({
            row: index + 2,
            field: csvKeyField,
            type: 'warning',
            message: 'Duplicate identifier found',
            value: keyValue,
            suggestion: 'Ensure all IDs are unique or the later entry will overwrite the earlier one'
          });
        } else {
          seenValues.add(keyValue);
        }
      }
    });
    
    return duplicateCount;
  };

  const analyzeCSVStructure = async (file: File, type: 'accounts' | 'contacts') => {
    try {
      const text = await file.text();
      const rawData = parseCSV(text);
      
      if (rawData.length === 0) {
        throw new Error("No data found in CSV file");
      }

      const headers = Object.keys(rawData[0]);
      const sampleRows = rawData.slice(0, 5); // Get first 5 rows for preview
      
      setCsvHeaders(headers);
      setSampleData(sampleRows);
      setPendingFile({ file, type });
      setShowFieldMapping(true);
      
    } catch (error) {
      console.error('Error analyzing CSV:', error);
      toast({
        title: "CSV Analysis Failed",
        description: "Unable to read the CSV file. Please check the file format and try again.",
        variant: "destructive"
      });
    }
  };

  const validateDataWithMapping = (rawData: any[], mapping: FieldMapping, type: 'accounts' | 'contacts'): ValidationResult => {
    const issues: ValidationIssue[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    
    // Field analysis
    const fieldAnalysis: FieldAnalysis[] = [];
    const mappedFields = Object.values(mapping).filter(Boolean);
    
    mappedFields.forEach(field => {
      if (!field) return;
      
      const csvField = Object.keys(mapping).find(key => mapping[key] === field);
      if (!csvField) return;
      
      const values = rawData.map(row => row[csvField]).filter(v => v !== null && v !== undefined && v !== '');
      const uniqueValues = [...new Set(values)];
      const completeness = (values.length / rawData.length) * 100;
      
      const analysis: FieldAnalysis = {
        field: csvField,
        completeness,
        uniqueValues: uniqueValues.length,
        commonValues: [],
        dataType: 'string',
        issues: []
      };
      
      // Detect data type
      if (field === 'employee_count') {
        analysis.dataType = 'number';
        values.forEach((val, idx) => {
          if (val && isNaN(Number(val))) {
            analysis.issues.push(`Row ${idx + 2}: "${val}" is not a valid number`);
          }
        });
      } else if (field === 'email') {
        analysis.dataType = 'email';
        values.forEach((val, idx) => {
          if (val && !val.includes('@')) {
            analysis.issues.push(`Row ${idx + 2}: "${val}" is not a valid email`);
          }
        });
      }
      
      // Get common values
      const valueCounts = values.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      analysis.commonValues = Object.entries(valueCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([value, count]) => ({ value, count: count as number }));
      
      fieldAnalysis.push(analysis);
    });

    // Validate each row
    rawData.forEach((row, index) => {
      let rowHasErrors = false;
      let rowHasWarnings = false;

      // Check required fields
      Object.entries(mapping).forEach(([csvField, schemaField]) => {
        if (!schemaField) return;
        
        const value = row[csvField];
        const rowNum = index + 2; // +2 because index is 0-based and we skip header

        // Check required fields
        if (type === 'accounts' && schemaField === 'external_id' && !value) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'error',
            message: 'External ID is required',
            value: value,
            suggestion: 'Provide a unique identifier for this account'
          });
          rowHasErrors = true;
        }

        if (type === 'contacts' && (schemaField === 'external_id' || schemaField === 'account_external_id') && !value) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'error',
            message: `${schemaField === 'external_id' ? 'Contact ID' : 'Account ID'} is required`,
            value: value,
            suggestion: 'Provide a unique identifier'
          });
          rowHasErrors = true;
        }

        // Validate data types
        if (value && schemaField === 'employee_count' && isNaN(Number(value))) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'error',
            message: 'Employee count must be a number',
            value: value,
            suggestion: 'Use numeric values only (e.g., 100, 500)'
          });
          rowHasErrors = true;
        }

        // Email validation
        if (value && schemaField === 'email' && !value.includes('@')) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'warning',
            message: 'Invalid email format',
            value: value,
            suggestion: 'Check email format (should contain @)'
          });
          rowHasWarnings = true;
        }

        // Missing important fields (warnings)
        if (!value && ['name', 'domain', 'industry_raw', 'first_name', 'last_name'].includes(schemaField)) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'warning',
            message: 'Missing recommended field',
            value: value,
            suggestion: 'Consider adding this information for better scoring'
          });
          rowHasWarnings = true;
        }
      });

      if (rowHasErrors) {
        errorCount++;
      } else if (rowHasWarnings) {
        warningCount++;
      } else {
        validCount++;
      }
    });

    // Calculate data quality scores
    const totalFields = Object.keys(mapping).length;
    const filledFields = rawData.reduce((sum, row) => {
      return sum + Object.keys(mapping).filter(field => row[field]).length;
    }, 0);
    
    // Implement duplicate detection
    const duplicateCount = detectDuplicates(rawData, mapping, type, issues);
    
    const completeness = (filledFields / (rawData.length * totalFields)) * 100;
    const accuracy = ((validCount + warningCount) / rawData.length) * 100;
    const consistency = 100 - (issues.filter(i => i.message.includes('format')).length / rawData.length) * 100;
    
    const dataQuality: DataQualityScore = {
      overall: Math.round((completeness + accuracy + consistency) / 3),
      completeness: Math.round(completeness),
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency),
      details: {
        missingValues: rawData.length * totalFields - filledFields,
        invalidFormats: issues.filter(i => i.message.includes('format')).length,
        duplicates: duplicateCount
      }
    };

    return {
      total: rawData.length,
      valid: validCount,
      warnings: warningCount,
      errors: errorCount,
      issues,
      dataQuality,
      fieldAnalysis
    };
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

      // Validate data with mapping
      const validation = validateDataWithMapping(rawData, mapping, pendingFile.type);
      setValidationResult(validation);
      
      setUploadProgress(50);

      // Transform data using mapping
      const transformedData = rawData.map(row => {
        const transformed: any = { org_id: userProfile.org_id };
        
        Object.entries(mapping).forEach(([csvField, schemaField]) => {
          if (schemaField && row[csvField] !== undefined) {
            let value = row[csvField];
            
            // Convert data types
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
      let updated = 0;

      if (validData.length > 0) {
        const tableName = pendingFile.type === 'accounts' ? 'accounts' : 'contacts';
        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(validData, { 
            onConflict: pendingFile.type === 'accounts' ? 'org_id,external_id' : 'org_id,external_id'
          });

        if (upsertError) {
          throw upsertError;
        }

        inserted = validData.length;
      }

      // Create sync job record
      const { error: jobError } = await supabase
        .from('sync_jobs')
        .insert({
          org_id: userProfile.org_id,
          source_system: 'csv_upload',
          job_type: pendingFile.type,
          received: rawData.length,
          inserted,
          updated,
          rejected: validation.errors,
          status: 'completed',
          finished_at: new Date().toISOString()
        });

      if (jobError) {
        console.error('Error creating sync job:', jobError);
      }

      setUploadProgress(100);

      setUploadResult({
        total: rawData.length,
        inserted,
        updated,
        rejected: validation.errors,
        errors: validation.issues.filter(i => i.type === 'error').map(i => i.message)
      });

      toast({
        title: "Upload completed",
        description: `Processed ${rawData.length} rows, imported ${inserted} valid records`
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Data Upload Failed",
        description: error.message?.includes('duplicate key') 
          ? "Some records already exist. Data was updated where possible."
          : "Unable to save your data. Please check your file format and try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  const downloadTemplate = (type: 'accounts' | 'contacts') => {
    const headers = type === 'accounts' ? ACCOUNTS_HEADERS : CONTACTS_HEADERS;
    const csvContent = headers.join(',') + '\n';
    
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

      {/* Hero Metric */}
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload Accounts
              </CardTitle>
              <CardDescription>
                Import company/account data to build your pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Required headers:</strong> {ACCOUNTS_HEADERS.join(', ')}
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => downloadTemplate('accounts')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <div>
                  <Input
                    ref={accountsFileRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) analyzeCSVStructure(file, 'accounts');
                    }}
                    className="hidden"
                  />
                  <Button 
                    onClick={() => accountsFileRef.current?.click()}
                    disabled={uploading}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {uploading ? 'Processing...' : 'Upload & Map Fields'}
                  </Button>
                </div>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground">Processing upload...</p>
                </div>
              )}

              {uploadResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{uploadResult.total}</div>
                      <div className="text-sm text-muted-foreground">Total Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.inserted}</div>
                      <div className="text-sm text-muted-foreground">Inserted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{uploadResult.updated}</div>
                      <div className="text-sm text-muted-foreground">Updated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{uploadResult.rejected}</div>
                      <div className="text-sm text-muted-foreground">Rejected</div>
                    </div>
                  </div>

                  {uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {uploadResult.rejected} rows were rejected due to validation errors.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={downloadRejections}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Rejections
                      </Button>
                    </div>
                  )}

                  {uploadResult.rejected === 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        All rows were processed successfully!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload Contacts
              </CardTitle>
              <CardDescription>
                Import contact data linked to your accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Required headers:</strong> {CONTACTS_HEADERS.join(', ')}
                  <br />
                  <strong>Note:</strong> account_external_id must match an existing account's external_id
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => downloadTemplate('contacts')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <div>
                  <Input
                    ref={contactsFileRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) analyzeCSVStructure(file, 'contacts');
                    }}
                    className="hidden"
                  />
                  <Button 
                    onClick={() => contactsFileRef.current?.click()}
                    disabled={uploading}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {uploading ? 'Processing...' : 'Upload & Map Fields'}
                  </Button>
                </div>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground">Processing upload...</p>
                </div>
              )}

              {uploadResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{uploadResult.total}</div>
                      <div className="text-sm text-muted-foreground">Total Rows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.inserted}</div>
                      <div className="text-sm text-muted-foreground">Inserted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{uploadResult.updated}</div>
                      <div className="text-sm text-muted-foreground">Updated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{uploadResult.rejected}</div>
                      <div className="text-sm text-muted-foreground">Rejected</div>
                    </div>
                  </div>

                  {uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {uploadResult.rejected} rows were rejected due to validation errors.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={downloadRejections}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Rejections
                      </Button>
                    </div>
                  )}

                  {uploadResult.rejected === 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        All rows were processed successfully!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Validation Results */}
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
                // Download comprehensive validation report
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
                // Download only valid records
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
                // Download error report
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

      {/* Field Mapping Dialog */}
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