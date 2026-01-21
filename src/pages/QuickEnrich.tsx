import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  Loader2,
  FileSpreadsheet,
  Users,
  Building2,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  AlertCircle,
  BarChart3,
  DollarSign,
  Target
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseCSV, LEADS_HEADERS, generateCSVTemplate } from "@/utils/csv-parser";
import { FieldMappingDialog, FieldMapping } from "@/components/data-upload/FieldMappingDialog";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataQualityReport } from "@/components/enrichment/DataQualityReport";
import { EnrichmentCostTracker } from "@/components/enrichment/EnrichmentCostTracker";
import { AccuracyBenchmark } from "@/components/enrichment/AccuracyBenchmark";

type WizardStep = "upload" | "configure" | "process" | "download";

interface UploadStats {
  total: number;
  uploaded: number;
  matched: number;
}

interface EnrichmentStats {
  processed: number;
  enriched: number;
  total: number;
  contactsDiscovered: number;
  fieldsEnriched?: number;
}

interface CostBreakdown {
  firecrawl: number;
  perplexity: number;
  ai_fallback: number;
  total: number;
}

export default function QuickEnrich() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [step, setStep] = useState<WizardStep>("upload");
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  
  // Config state
  const [enableContactDiscovery, setEnableContactDiscovery] = useState(false);
  
  // Track uploaded account IDs for targeted enrichment
  const [uploadedAccountIds, setUploadedAccountIds] = useState<string[]>([]);
  
  // Enrichment state
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | null>(null);
  const [enrichmentStats, setEnrichmentStats] = useState<EnrichmentStats | null>(null);
  const [enrichedAccounts, setEnrichedAccounts] = useState<any[]>([]);
  const [enrichmentComplete, setEnrichmentComplete] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [activeResultsTab, setActiveResultsTab] = useState("preview");

  // Poll for enrichment progress
  useEffect(() => {
    if (!enrichmentJobId || enrichmentComplete) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("enrichment_jobs")
        .select("*")
        .eq("id", enrichmentJobId)
        .single();

      if (data) {
        setEnrichmentStats({
          processed: data.processed_records || 0,
          enriched: data.accounts_enriched || 0,
          total: data.total_records || 0,
          contactsDiscovered: 0 // Will be counted separately
        });

        if (data.status === "completed") {
          setEnrichmentComplete(true);
          setStep("download");
          fetchEnrichedAccounts();
          toast.success("Enrichment complete!");
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enrichmentJobId, enrichmentComplete]);

  const analyzeCSV = async (file: File) => {
    try {
      const text = await file.text();
      const rawData = parseCSV(text);
      
      if (rawData.length === 0) {
        throw new Error("No data found in CSV file");
      }

      const headers = Object.keys(rawData[0]);
      const sampleRows = rawData.slice(0, 5);
      
      // Smart auto-mapping
      const autoMapping: FieldMapping = {};
      
      headers.forEach(header => {
        const normalized = header.toLowerCase().trim();
        
        if (normalized.match(/^(company|company_name|account|account_name)$/)) {
          autoMapping[header] = 'company';
        } else if (normalized.match(/^(email|email_address|contact_email|e-mail)$/)) {
          autoMapping[header] = 'email';
        } else if (normalized.match(/^(first_name|firstname|fname|first|given_name)$/)) {
          autoMapping[header] = 'first_name';
        } else if (normalized.match(/^(last_name|lastname|lname|last|surname|family_name)$/)) {
          autoMapping[header] = 'last_name';
        } else if (normalized.match(/^(title|job_title|position|role)$/)) {
          autoMapping[header] = 'title';
        } else if (LEADS_HEADERS.includes(normalized)) {
          autoMapping[header] = normalized;
        }
      });
      
      const mappedCount = Object.keys(autoMapping).length;
      const confidence = (mappedCount / Math.min(LEADS_HEADERS.length, headers.length)) * 100;
      
      if (confidence > 80) {
        // High confidence - proceed directly
        await handleUpload(file, rawData, autoMapping);
      } else {
        // Show mapping dialog
        setCsvHeaders(headers);
        setSampleData(sampleRows);
        setPendingFile(file);
        setShowFieldMapping(true);
      }
      
    } catch (error: any) {
      toast.error("Failed to read CSV file", {
        description: error.message
      });
    }
  };

  const handleUpload = async (file: File, rawData: any[], mapping: FieldMapping) => {
    if (!userProfile?.org_id) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const reverseMapping: Record<string, string> = {};
      Object.entries(mapping).forEach(([csvCol, dbField]) => {
        if (dbField) reverseMapping[dbField] = csvCol;
      });

      setUploadProgress(20);

      // Use edge function for upload
      const { data, error } = await supabase.functions.invoke('bulk-upload', {
        body: {
          data: rawData,
          mapping: mapping,
          orgId: userProfile.org_id,
          isExternalDatabase: false
        }
      });

      if (error) throw error;

      setUploadProgress(80);

      setUploadStats({
        total: rawData.length,
        uploaded: data.insertedLeads || data.inserted || 0,
        matched: data.matchedAccounts || data.matching?.accounts_created || 0
      });

      // Store the created account IDs for targeted enrichment
      if (data.created_account_ids && data.created_account_ids.length > 0) {
        setUploadedAccountIds(data.created_account_ids);
        console.log(`[QuickEnrich] Stored ${data.created_account_ids.length} account IDs for enrichment`);
      }

      setUploadProgress(100);
      setStep("configure");
      toast.success(`Uploaded ${data.insertedLeads || data.inserted} leads!`);

    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
    } finally {
      setUploading(false);
      setShowFieldMapping(false);
      setPendingFile(null);
    }
  };

  const startEnrichment = async () => {
    if (!userProfile?.org_id) return;

    try {
      setStep("process");
      
      // Use ONLY the uploaded account IDs, not the entire database
      const accountIdsToEnrich = uploadedAccountIds;
      const totalToEnrich = accountIdsToEnrich.length;
      
      console.log(`[QuickEnrich] Starting enrichment for ${totalToEnrich} uploaded accounts`);

      if (totalToEnrich === 0) {
        toast.error("No accounts to enrich", { 
          description: "Please upload a file with company data first" 
        });
        setStep("configure");
        return;
      }

      // Use unified enrichment for all batch sizes
      console.log(`[QuickEnrich] Using unified enrichment for ${totalToEnrich} accounts`);
      
      // Build records from account IDs
      const { data: accounts, error: fetchError } = await supabase
        .from('accounts')
        .select('id, external_id, name, domain')
        .in('id', accountIdsToEnrich);
      
      if (fetchError) throw fetchError;
      
      const records = (accounts || []).map(a => ({
        id: a.id,
        external_id: a.external_id,
        name: a.name,
        domain: a.domain
      }));

      const { data, error } = await supabase.functions.invoke("enrich-unified", {
        body: {
          org_id: userProfile.org_id,
          record_type: 'account',
          records,
          config: {
            skipPaidProviders: true, // Free enrichment by default
          }
        }
      });

      if (error) throw error;

      // Handle async job response
      if (data?.job_id) {
        setEnrichmentJobId(data.job_id);
      }
      
      setEnrichmentStats({
        processed: data.summary?.processed || 0,
        enriched: data.summary?.enriched || 0,
        total: totalToEnrich,
        contactsDiscovered: 0,
        fieldsEnriched: 0
      });
      
      // Set cost breakdown if available
      if (data.summary?.totalCost) {
        setCostBreakdown({ 
          total: data.summary.totalCost,
          firecrawl: data.source_breakdown?.firecrawl?.cost || 0,
          perplexity: data.source_breakdown?.perplexity?.cost || 0,
          ai_fallback: data.source_breakdown?.ai?.cost || 0
        });
      }
      
      if (data.status === 'completed') {
        setEnrichmentComplete(true);
        setStep("download");
        fetchEnrichedAccounts();
        toast.success(`Enrichment complete! ${data.summary?.enriched || 0} accounts enriched.`);
      } else {
        toast.success("Enrichment started!");
      }

    } catch (error: any) {
      console.error("[QuickEnrich] Enrichment error:", error);
      toast.error("Failed to start enrichment", { description: error.message });
      setStep("configure");
    }
  };

  const exportData = async (type: "accounts" | "leads") => {
    if (!userProfile?.org_id) return;

    try {
      toast.info(`Preparing ${type} export...`);

      if (type === "accounts") {
        // Export ONLY the uploaded accounts, not all enriched accounts
        if (uploadedAccountIds.length === 0) {
          toast.warning("No accounts to export");
          return;
        }
        
        const { data: accounts, error } = await supabase
          .from("accounts")
          .select("*")
          .in("id", uploadedAccountIds)
          .order("name");

        if (error) throw error;

        downloadCSV(accounts, `enriched_accounts_${new Date().toISOString().split("T")[0]}.csv`);
        toast.success(`Exported ${accounts?.length || 0} accounts!`);
      } else {
        // Export leads from the uploaded accounts only
        if (uploadedAccountIds.length === 0) {
          toast.warning("No leads to export");
          return;
        }
        
        // Get external_ids for the uploaded accounts
        const { data: accountData } = await supabase
          .from("accounts")
          .select("external_id")
          .in("id", uploadedAccountIds);
        
        const externalIds = accountData?.map(a => a.external_id) || [];
        
        const { data: leads, error } = await supabase
          .from("Leads")
          .select("*")
          .eq("org_id", userProfile.org_id)
          .in("account_external_id", externalIds)
          .order("company");

        if (error) throw error;

        downloadCSV(leads, `leads_${new Date().toISOString().split("T")[0]}.csv`);
        toast.success(`Exported ${leads?.length || 0} leads!`);
      }
    } catch (error: any) {
      toast.error("Export failed", { description: error.message });
    }
  };
  
  // Fetch enriched accounts for preview
  const fetchEnrichedAccounts = async () => {
    if (uploadedAccountIds.length === 0) return;
    
    const { data } = await supabase
      .from("accounts")
      .select("id, name, domain, industry_norm, employee_count, revenue_range, city, state_province, country, linkedin_url, enriched_at, enrichment_confidence, enriched_from, enrichment_citations, enrichment_field_scores")
      .in("id", uploadedAccountIds)
      .order("name");
    
    setEnrichedAccounts(data || []);
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        if (Array.isArray(val)) return `"${val.join("; ")}"`;
        return String(val);
      });
      csvRows.push(values.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const progressPercent = enrichmentStats 
    ? Math.round((enrichmentStats.processed / Math.max(enrichmentStats.total, 1)) * 100)
    : 0;

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <LaunchPulseMark className="h-10 w-10" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Quick Enrich</h1>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Upload a CSV with your leads or accounts. We'll automatically create accounts, match leads, and enrich company data using AI.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-muted-foreground">
              Upload, enrich, and download in minutes
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4">
          {["upload", "configure", "process", "download"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                step === s 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : ["upload", "configure", "process", "download"].indexOf(step) > i
                    ? "bg-primary/20 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-muted-foreground/30"
              }`}>
                {["upload", "configure", "process", "download"].indexOf(step) > i ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div className={`w-16 sm:w-24 h-0.5 mx-2 ${
                  ["upload", "configure", "process", "download"].indexOf(step) > i
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Step 1: Upload Your Data
              </CardTitle>
              <CardDescription>
                Upload a CSV file with your leads or accounts. We'll automatically match and create accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Download Template */}
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Need a template?</p>
                  <p className="text-sm text-muted-foreground">
                    Download our sample CSV to see the expected format
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const csv = generateCSVTemplate("leads");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "leads_template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              {/* Upload Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  uploading ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file?.name.endsWith(".csv")) analyzeCSV(file);
                }}
              >
                {uploading ? (
                  <div className="space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Uploading and processing...</p>
                    <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">
                      Drag & drop your CSV file here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      id="csv-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) analyzeCSV(file);
                        e.target.value = "";
                      }}
                    />
                    <Button asChild>
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        Select File
                      </label>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Configure */}
        {step === "configure" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Step 2: Configure Enrichment
              </CardTitle>
              <CardDescription>
                Choose what data to enrich and optionally discover contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Summary */}
              {uploadStats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg border bg-muted/30">
                    <p className="text-2xl font-bold">{uploadStats.total.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Records in file</p>
                  </div>
                  <div className="text-center p-4 rounded-lg border bg-green-500/10">
                    <p className="text-2xl font-bold text-green-600">{uploadStats.uploaded.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Leads uploaded</p>
                  </div>
                  <div className="text-center p-4 rounded-lg border bg-primary/10">
                    <p className="text-2xl font-bold text-primary">{uploadStats.matched.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Accounts created</p>
                  </div>
                </div>
              )}

              {/* Enrichment Type */}
              <div className="p-4 rounded-lg border bg-green-500/5 border-green-500/20">
                <div className="flex items-center gap-3">
                  <LaunchPulseMark className="h-8 w-8" />
                  <div className="flex-1">
                    <p className="font-medium">Launch Pulse AI Enrichment</p>
                    <p className="text-sm text-muted-foreground">
                      Free AI-powered enrichment fills in employee count, revenue, industry, LinkedIn URLs, and more
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600">Free</Badge>
                </div>
              </div>

              {/* Contact Discovery Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="contact-discovery" className="font-medium">
                        Discover Contacts
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Find decision-makers (CEO, VP Sales, etc.) at high-fit accounts during enrichment</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Find decision-makers at enriched accounts
                    </p>
                  </div>
                </div>
                <Switch
                  id="contact-discovery"
                  checked={enableContactDiscovery}
                  onCheckedChange={setEnableContactDiscovery}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button className="flex-1" onClick={startEnrichment}>
                  Start Enrichment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Processing */}
        {step === "process" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Step 3: Enriching Your Data
              </CardTitle>
              <CardDescription>
                This may take a few minutes. You can leave this page - enrichment continues in the background.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {enrichmentStats && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg border">
                      <p className="text-2xl font-bold">{enrichmentStats.processed.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Processed</p>
                    </div>
                    <div className="text-center p-4 rounded-lg border bg-green-500/10">
                      <p className="text-2xl font-bold text-green-600">{enrichmentStats.enriched.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Enriched</p>
                    </div>
                    <div className="text-center p-4 rounded-lg border">
                      <p className="text-2xl font-bold">{enrichmentStats.total.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-3" />
                  </div>
                </>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Enrichment runs in the background with auto-continuation. Large datasets (10,000+ records) may take 15-30 minutes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Download */}
        {step === "download" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Step 4: Download Your Data
              </CardTitle>
              <CardDescription>
                Enrichment complete! Preview and download your enriched data with verified sources.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {enrichmentStats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-6 rounded-lg border bg-green-500/10">
                    <p className="text-3xl font-bold text-green-600">{enrichmentStats.enriched.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Accounts Enriched</p>
                  </div>
                  <div className="text-center p-6 rounded-lg border bg-primary/10">
                    <p className="text-3xl font-bold text-primary">{uploadedAccountIds.length.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Uploaded</p>
                  </div>
                  <div className="text-center p-6 rounded-lg border bg-blue-500/10">
                    <p className="text-3xl font-bold text-blue-600">
                      {enrichedAccounts.filter(a => a.enrichment_confidence && a.enrichment_confidence >= 80).length}
                    </p>
                    <p className="text-sm text-muted-foreground">High Confidence</p>
                  </div>
                </div>
              )}

              {/* Results Tabs */}
              <Tabs value={activeResultsTab} onValueChange={setActiveResultsTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="preview" className="flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="quality" className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    Quality
                  </TabsTrigger>
                  <TabsTrigger value="cost" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Cost
                  </TabsTrigger>
                  <TabsTrigger value="accuracy" className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Benchmark
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="space-y-4 mt-4">
                  {/* Data Source Badge Legend */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Data Sources:</span>
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                      Verified (Multi-Source)
                    </Badge>
                    <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
                      Web Search
                    </Badge>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                      AI Estimated
                    </Badge>
                  </div>

              {/* Data Preview Table with Confidence */}
              {enrichedAccounts.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                    <p className="font-medium text-sm">Enriched Accounts Preview</p>
                    <span className="text-xs text-muted-foreground">
                      Confidence scores indicate data reliability
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Company</th>
                          <th className="text-left px-3 py-2 font-medium">Domain</th>
                          <th className="text-left px-3 py-2 font-medium">Industry</th>
                          <th className="text-left px-3 py-2 font-medium">Employees</th>
                          <th className="text-left px-3 py-2 font-medium">Revenue</th>
                          <th className="text-left px-3 py-2 font-medium">Location</th>
                          <th className="text-left px-3 py-2 font-medium">Confidence</th>
                          <th className="text-left px-3 py-2 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {enrichedAccounts.slice(0, 50).map((account) => {
                          const confidence = account.enrichment_confidence || 0;
                          const source = account.enriched_from || 'unknown';
                          
                          // Determine confidence color
                          const confidenceColor = confidence >= 80 
                            ? 'text-green-600 bg-green-50' 
                            : confidence >= 60 
                              ? 'text-blue-600 bg-blue-50'
                              : 'text-amber-600 bg-amber-50';
                          
                          // Determine source badge
                          const sourceLabel = source === 'verified_multi_source' 
                            ? 'Verified' 
                            : source === 'perplexity' 
                              ? 'Web Search'
                              : source === 'firecrawl-website'
                                ? 'Website'
                                : source === 'launch_pulse'
                                  ? 'AI Est.'
                                  : source;
                          
                          const sourceBadgeClass = source === 'verified_multi_source'
                            ? 'text-green-600 border-green-300 bg-green-50'
                            : source === 'perplexity' || source === 'firecrawl-website'
                              ? 'text-blue-600 border-blue-300 bg-blue-50'
                              : 'text-amber-600 border-amber-300 bg-amber-50';
                          
                          return (
                            <tr key={account.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">{account.name || "-"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{account.domain || "-"}</td>
                              <td className="px-3 py-2">
                                {account.industry_norm ? (
                                  <Badge variant="secondary" className="text-xs">{account.industry_norm}</Badge>
                                ) : "-"}
                              </td>
                              <td className="px-3 py-2">
                                {account.employee_count ? account.employee_count.toLocaleString() : "-"}
                              </td>
                              <td className="px-3 py-2">{account.revenue_range || "-"}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {[account.city, account.state_province, account.country].filter(Boolean).join(", ") || "-"}
                              </td>
                              <td className="px-3 py-2">
                                {confidence > 0 ? (
                                  <Badge variant="outline" className={`text-xs ${confidenceColor}`}>
                                    {confidence}%
                                  </Badge>
                                ) : "-"}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={`text-xs ${sourceBadgeClass}`}>
                                  {sourceLabel}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {enrichedAccounts.length > 50 && (
                    <div className="bg-muted/30 px-4 py-2 border-t text-center text-sm text-muted-foreground">
                      Showing 50 of {enrichedAccounts.length} accounts. Download to see all.
                    </div>
                  )}
                </div>
              )}
                </TabsContent>

                <TabsContent value="quality" className="mt-4">
                  <DataQualityReport accounts={enrichedAccounts} />
                </TabsContent>

                <TabsContent value="cost" className="mt-4">
                  <EnrichmentCostTracker
                    totalRecords={uploadedAccountIds.length}
                    enrichedRecords={enrichmentStats?.enriched || 0}
                    fieldsEnriched={enrichmentStats?.fieldsEnriched || 0}
                    costBreakdown={costBreakdown || undefined}
                  />
                </TabsContent>

                <TabsContent value="accuracy" className="mt-4">
                  <AccuracyBenchmark accounts={enrichedAccounts} />
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => exportData("accounts")}
                >
                  <Building2 className="h-6 w-6" />
                  <span>Download Accounts ({uploadedAccountIds.length})</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => exportData("leads")}
                >
                  <Users className="h-6 w-6" />
                  <span>Download Leads</span>
                </Button>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button variant="outline" onClick={() => navigate("/enrichment")}>
                  Go to Enrichment Dashboard
                </Button>
                <Button onClick={() => {
                  setStep("upload");
                  setUploadStats(null);
                  setEnrichmentStats(null);
                  setEnrichmentComplete(false);
                  setEnrichmentJobId(null);
                  setEnrichedAccounts([]);
                  setUploadedAccountIds([]);
                  setCostBreakdown(null);
                }}>
                  Enrich Another File
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Field Mapping Dialog */}
        {showFieldMapping && pendingFile && (
          <FieldMappingDialog
            isOpen={showFieldMapping}
            onClose={() => {
              setShowFieldMapping(false);
              setPendingFile(null);
            }}
            csvHeaders={csvHeaders}
            sampleData={sampleData}
            dataType="leads"
            onConfirm={async (mapping) => {
              const text = await pendingFile.text();
              const rawData = parseCSV(text);
              await handleUpload(pendingFile, rawData, mapping);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
