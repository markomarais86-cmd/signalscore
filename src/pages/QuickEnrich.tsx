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
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseCSV, LEADS_HEADERS, generateCSVTemplate } from "@/utils/csv-parser";
import { FieldMappingDialog, FieldMapping } from "@/components/data-upload/FieldMappingDialog";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  
  // Enrichment state
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | null>(null);
  const [enrichmentStats, setEnrichmentStats] = useState<EnrichmentStats | null>(null);
  const [enrichmentComplete, setEnrichmentComplete] = useState(false);

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
        uploaded: data.insertedLeads || 0,
        matched: data.matchedAccounts || 0
      });

      setUploadProgress(100);
      setStep("configure");
      toast.success(`Uploaded ${data.insertedLeads} leads!`);

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
      
      // Get count of accounts to enrich
      const { count } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id);

      const { data, error } = await supabase.functions.invoke("enrich-free-orchestrator", {
        body: {
          org_id: userProfile.org_id,
          create_new: true,
          total_records: count || 0,
          enable_contact_discovery: enableContactDiscovery
        }
      });

      if (error) throw error;

      setEnrichmentJobId(data.job_id);
      setEnrichmentStats({
        processed: 0,
        enriched: 0,
        total: count || 0,
        contactsDiscovered: 0
      });

      toast.success("Enrichment started!");

    } catch (error: any) {
      toast.error("Failed to start enrichment", { description: error.message });
      setStep("configure");
    }
  };

  const exportData = async (type: "accounts" | "leads") => {
    if (!userProfile?.org_id) return;

    try {
      toast.info(`Preparing ${type} export...`);

      if (type === "accounts") {
        const { data: accounts, error } = await supabase
          .from("accounts")
          .select("*")
          .eq("org_id", userProfile.org_id)
          .not("enriched_at", "is", null)
          .order("name");

        if (error) throw error;

        downloadCSV(accounts, `enriched_accounts_${new Date().toISOString().split("T")[0]}.csv`);
        toast.success(`Exported ${accounts?.length || 0} accounts!`);
      } else {
        const { data: leads, error } = await supabase
          .from("Leads")
          .select("*")
          .eq("org_id", userProfile.org_id)
          .order("company");

        if (error) throw error;

        downloadCSV(leads, `leads_${new Date().toISOString().split("T")[0]}.csv`);
        toast.success(`Exported ${leads?.length || 0} leads!`);
      }
    } catch (error: any) {
      toast.error("Export failed", { description: error.message });
    }
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
                Enrichment complete! Download your enriched data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {enrichmentStats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-6 rounded-lg border bg-green-500/10">
                    <p className="text-3xl font-bold text-green-600">{enrichmentStats.enriched.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Accounts Enriched</p>
                  </div>
                  <div className="text-center p-6 rounded-lg border bg-primary/10">
                    <p className="text-3xl font-bold text-primary">{enrichmentStats.contactsDiscovered.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Contacts Discovered</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => exportData("accounts")}
                >
                  <Building2 className="h-6 w-6" />
                  <span>Download Accounts</span>
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
