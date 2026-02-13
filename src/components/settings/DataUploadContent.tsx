import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileCheck, Info, Sparkles, Download, Upload, FileText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/use-onboarding";
import { formatNumber } from "@/utils/format-numbers";
import { ClosedWonUpload } from "@/components/data-upload/ClosedWonUpload";
import { DataProcessingPipeline } from "@/components/data-upload/DataProcessingPipeline";
import { ReferenceDBUpload } from "@/components/settings/ReferenceDBUpload";
import { BulkLeadMatcher } from "@/components/data-upload/BulkLeadMatcher";
import { parseCSV, LEADS_HEADERS, generateCSVTemplate } from "@/utils/csv-parser";

interface UploadResult {
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

interface FieldMapping {
  [csvColumn: string]: string;
}

export default function DataUploadContent() {
  const [activeTab, setActiveTab] = useState('leads');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isExternalDatabase, setIsExternalDatabase] = useState(false);
  const [unlinkedLeads, setUnlinkedLeads] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    const saved = localStorage.getItem('showAdvancedDataUpload');
    return saved === 'true';
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { completeStep } = useOnboarding();

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

  const handleFileUpload = async (file: File) => {
    if (!userProfile?.org_id) {
      toast({
        title: "Upload Error",
        description: "Authentication required",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    const orgId = userProfile.org_id;
    let insertedLeads = 0;
    const errors: string[] = [];

    try {
      const text = await file.text();
      const rawData = parseCSV(text);
      
      if (rawData.length === 0) {
        throw new Error("No data found in CSV file");
      }

      setUploadProgress(10);

      // Auto-map fields
      const headers = Object.keys(rawData[0]);
      const mapping: FieldMapping = {};
      
      headers.forEach(header => {
        const normalized = header.toLowerCase().trim();
        
        if (normalized.match(/^(company|company_name|account|account_name)$/)) {
          mapping[header] = 'company';
        }
        else if (normalized.match(/^(email|email_address|contact_email|e-mail)$/)) {
          mapping[header] = 'email';
        }
        else if (normalized.match(/^(first_name|firstname|fname|first|given_name)$/)) {
          mapping[header] = 'first_name';
        }
        else if (normalized.match(/^(last_name|lastname|lname|last|surname|family_name)$/)) {
          mapping[header] = 'last_name';
        }
        else if (normalized.match(/^(title|job_title|position|role)$/)) {
          mapping[header] = 'title';
        }
        else if (LEADS_HEADERS.includes(normalized)) {
          mapping[header] = normalized;
        }
      });

      setUploadProgress(20);

      if (rawData.length > 5000) {
        toast({
          title: "Large Upload Detected",
          description: `Processing ${rawData.length} leads in the background...`,
        });

        const { data, error } = await supabase.functions.invoke('bulk-upload', {
          body: {
            data: rawData,
            mapping: mapping,
            orgId: orgId,
            isExternalDatabase: isExternalDatabase
          }
        });

        if (error) throw error;

        insertedLeads = data.insertedLeads || 0;
        errors.push(...(data.errors || []));
      } else {
        const reverseMapping: Record<string, string> = {};
        Object.entries(mapping).forEach(([csvCol, dbField]) => {
          if (dbField) reverseMapping[dbField] = csvCol;
        });
        
        const batchSize = 1000;
        
        for (let i = 0; i < rawData.length; i += batchSize) {
          const batch = rawData.slice(i, Math.min(i + batchSize, rawData.length));

          const leadsMap = new Map<string, any>();
          batch.forEach((row, idx) => {
            const firstName = reverseMapping.first_name && row[reverseMapping.first_name];
            const lastName = reverseMapping.last_name && row[reverseMapping.last_name];
            const company = reverseMapping.company && row[reverseMapping.company];
            const leadName = firstName && lastName ? `${firstName} ${lastName}` : company || 'Unknown Lead';
            
            const externalId = (reverseMapping.external_id && row[reverseMapping.external_id]) || `lead_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`;
            
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

          const { data: result, error } = await supabase
            .from('Leads')
            .upsert(leadsData, { onConflict: 'org_id,external_id', ignoreDuplicates: false })
            .select('id');

          if (error) {
            errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            insertedLeads += result?.length || 0;
          }

          setUploadProgress(20 + Math.round((i / rawData.length) * 60));
        }
      }

      setUploadProgress(100);

      setUploadResult({
        total: rawData.length,
        inserted: insertedLeads,
        updated: 0,
        rejected: errors.length,
        errors
      });

      await loadTotalRecords();
      completeStep('upload_data');
      
      toast({
        title: "Upload Complete!",
        description: `${insertedLeads} leads uploaded successfully.`,
      });

    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
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
    }
  };

  const downloadTemplate = () => {
    const csvContent = generateCSVTemplate('leads');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_template.csv';
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
      {/* Quick Start Section - Only show if no data yet */}
      {totalRecords === 0 && (
        <Card className="bg-gradient-to-br from-primary/5 via-secondary/5 to-background border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Quick Start: Upload Your First Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get started in under 2 minutes. Download our sample CSV template, then upload your own leads.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={downloadTemplate}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Sample CSV
              </Button>
              
              <Button 
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </Button>
              
              <Input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground">
                  {uploadProgress < 20 ? "Reading CSV..." : uploadProgress < 80 ? "Uploading leads..." : "Finalizing..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Leads</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totalRecords)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Unlinked Leads</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(unlinkedLeads)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Match Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {totalRecords > 0 ? `${Math.round(((totalRecords - unlinkedLeads) / totalRecords) * 100)}%` : "0%"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="advanced-mode"
          checked={showAdvanced}
          onCheckedChange={(checked) => {
            setShowAdvanced(checked);
            localStorage.setItem('showAdvancedDataUpload', String(checked));
          }}
        />
        <Label htmlFor="advanced-mode" className="text-sm">Show advanced options</Label>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads" className="gap-2">
            <Database className="h-4 w-4" />
            Leads Upload
          </TabsTrigger>
          <TabsTrigger value="closed-won" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Closed Won
          </TabsTrigger>
          {showAdvanced && (
            <TabsTrigger value="pipeline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
          )}
          <TabsTrigger value="reference-db" className="gap-2">
            <Database className="h-4 w-4" />
            Reference DB
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload Leads
              </CardTitle>
              <CardDescription>
                Import lead data with contact and company information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Required headers:</strong> {LEADS_HEADERS.slice(0, 6).join(', ')}...
                </AlertDescription>
              </Alert>

              {showAdvanced && (
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <Database className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor="external-db" className="text-sm font-medium">
                      External Database Upload (ZoomInfo, Apollo, etc.)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enable this if uploading from an external data provider.
                    </p>
                  </div>
                  <Switch
                    id="external-db"
                    checked={isExternalDatabase}
                    onCheckedChange={setIsExternalDatabase}
                    disabled={uploading}
                  />
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <div>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={uploading}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {uploading ? 'Processing...' : 'Upload CSV'}
                  </Button>
                </div>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground">Processing upload...</p>
                </div>
              )}

              {uploadResult && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{uploadResult.total}</p>
                      <p className="text-sm text-muted-foreground">Total Rows</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">{uploadResult.inserted}</p>
                      <p className="text-sm text-muted-foreground">Inserted</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-500">{uploadResult.updated}</p>
                      <p className="text-sm text-muted-foreground">Updated</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-500">{uploadResult.rejected}</p>
                      <p className="text-sm text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                  
                  {uploadResult.errors.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={downloadRejections}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Rejections
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {unlinkedLeads > 0 && (
            <BulkLeadMatcher unlinkedLeads={unlinkedLeads} onComplete={loadTotalRecords} />
          )}
        </TabsContent>

        <TabsContent value="closed-won">
          <ClosedWonUpload />
        </TabsContent>

        {showAdvanced && (
          <TabsContent value="pipeline">
            <DataProcessingPipeline />
          </TabsContent>
        )}

        <TabsContent value="reference-db">
          <ReferenceDBUpload />
        </TabsContent>
      </Tabs>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Upload leads with company information. LaunchPulse automatically creates accounts, 
          matches leads to accounts using domain/company name, and scores everything against your ICP.
        </AlertDescription>
      </Alert>
    </div>
  );
}