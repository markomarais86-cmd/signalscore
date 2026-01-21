import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Building2, 
  Users, 
  Sparkles, 
  Upload, 
  Database,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseCSV } from "@/utils/csv-parser";
import { EnrichmentProgressMonitor } from "@/components/settings/EnrichmentProgressMonitor";

type EnrichmentType = "accounts" | "leads";
type InputMethod = "paste" | "upload" | "existing";
type WizardStep = "type" | "input" | "preview" | "process" | "processing" | "results";

interface ParsedInput {
  type: "email" | "domain" | "company_name";
  value: string;
  domain?: string;
  // Preserve all input fields from CSV
  first_name?: string;
  last_name?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  company?: string;
}

interface EnrichmentResult {
  input: any;
  enriched_data: Record<string, any>;
  source: string;
  confidence: number;
  fields_filled: string[];
  domain_discovered?: boolean;
}

interface PreviewStats {
  total: number;
  with_domain: number;
  with_email: number;
  company_name_only: number;
}

export function UnifiedEnrichmentWizard() {
  const { userProfile } = useAuth();
  const [step, setStep] = useState<WizardStep>("type");
  const [enrichmentType, setEnrichmentType] = useState<EnrichmentType>("accounts");
  const [inputMethod, setInputMethod] = useState<InputMethod>("paste");
  const [pasteInput, setPasteInput] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  
  // Options
  // Default to FALSE - always force external enrichment for fresh data
  const [checkInternalFirst, setCheckInternalFirst] = useState(false);
  const [discoverDomains, setDiscoverDomains] = useState(true);
  const [saveToDatabase, setSaveToDatabase] = useState(true);
  
  // Processing state
  const [parsedInputs, setParsedInputs] = useState<ParsedInput[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Parse pasted input
  const parseInput = useCallback(() => {
    const lines = pasteInput.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    const parsed: ParsedInput[] = [];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const domainRegex = /^(https?:\/\/)?(www\.)?/;
    
    for (const line of lines) {
      // Email check
      if (line.includes('@') && emailRegex.test(line)) {
        const domain = line.split('@')[1];
        parsed.push({ type: 'email', value: line.toLowerCase(), domain });
      }
      // Domain check (contains dot, no spaces, no @)
      else if (line.includes('.') && !line.includes(' ') && !line.includes('@')) {
        const cleanDomain = line.replace(domainRegex, '').split('/')[0];
        parsed.push({ type: 'domain', value: cleanDomain.toLowerCase() });
      }
      // Company name
      else {
        parsed.push({ type: 'company_name', value: line });
      }
    }
    
    setParsedInputs(parsed);
    
    // Calculate preview stats
    const stats: PreviewStats = {
      total: parsed.length,
      with_domain: parsed.filter(p => p.type === 'domain' || p.domain).length,
      with_email: parsed.filter(p => p.type === 'email').length,
      company_name_only: parsed.filter(p => p.type === 'company_name').length
    };
    setPreviewStats(stats);
    
    if (parsed.length > 0) {
      setStep("preview");
    } else {
      toast.error("No valid entries found", { description: "Enter emails, domains, or company names" });
    }
  }, [pasteInput]);

  // Handle file upload - PRESERVE ALL INPUT FIELDS
  const handleFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        toast.error("No data found in CSV");
        return;
      }
      
      // Extract relevant fields - preserve ALL input data
      const parsed: ParsedInput[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      // Helper to find column by multiple possible names
      const findColumn = (row: Record<string, any>, ...names: string[]): string | undefined => {
        for (const name of names) {
          const entry = Object.entries(row).find(([k]) => 
            k.toLowerCase().replace(/[_\s]/g, '') === name.toLowerCase().replace(/[_\s]/g, '')
          );
          if (entry && entry[1]) return String(entry[1]);
        }
        return undefined;
      };
      
      for (const row of rows) {
        // Extract ALL possible fields from CSV
        const email = Object.entries(row).find(([k, v]) => 
          k.toLowerCase().includes('email') && typeof v === 'string' && emailRegex.test(v)
        )?.[1] as string;
        
        const domain = findColumn(row, 'domain', 'website', 'company_domain', 'companydomain');
        const company = findColumn(row, 'company', 'account', 'company_name', 'companyname', 'organization');
        
        // CRITICAL: Preserve personal contact fields
        const firstName = findColumn(row, 'first_name', 'firstname', 'first', 'executive_first_name', 'executivefirstname');
        const lastName = findColumn(row, 'last_name', 'lastname', 'last', 'executive_last_name', 'executivelastname');
        const title = findColumn(row, 'title', 'job_title', 'jobtitle', 'executive_title', 'executivetitle', 'position', 'role');
        const phone = findColumn(row, 'phone', 'phone_number', 'phonenumber', 'phone_1', 'phone1', 'direct_phone', 'directphone', 'mobile', 'cell');
        const linkedinUrl = findColumn(row, 'linkedin', 'linkedin_url', 'linkedinurl', 'executive_linkedin', 'executivelinkedin', 'linkedin_profile');
        
        if (email) {
          parsed.push({ 
            type: 'email', 
            value: email.toLowerCase(), 
            domain: email.split('@')[1],
            first_name: firstName,
            last_name: lastName,
            title,
            phone,
            linkedin_url: linkedinUrl,
            company
          });
        } else if (domain) {
          const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
          parsed.push({ 
            type: 'domain', 
            value: cleanDomain,
            first_name: firstName,
            last_name: lastName,
            title,
            phone,
            linkedin_url: linkedinUrl,
            company
          });
        } else if (company) {
          parsed.push({ 
            type: 'company_name', 
            value: company,
            first_name: firstName,
            last_name: lastName,
            title,
            phone,
            linkedin_url: linkedinUrl,
            company
          });
        }
      }
      
      setParsedInputs(parsed);
      setPreviewStats({
        total: parsed.length,
        with_domain: parsed.filter(p => p.type === 'domain' || p.domain).length,
        with_email: parsed.filter(p => p.type === 'email').length,
        company_name_only: parsed.filter(p => p.type === 'company_name').length
      });
      
      const fieldsPreserved = parsed.filter(p => p.first_name || p.last_name || p.title || p.phone).length;
      
      if (parsed.length > 0) {
        setStep("preview");
        toast.success(`Parsed ${parsed.length} records from CSV`, {
          description: fieldsPreserved > 0 ? `${fieldsPreserved} with personal details preserved` : undefined
        });
      } else {
        toast.error("No valid entries found in CSV");
      }
    } catch (error: any) {
      toast.error("Failed to parse CSV", { description: error.message });
    }
  };

  // Start enrichment
  const startEnrichment = async () => {
    if (!userProfile?.org_id || parsedInputs.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    setStep("process");
    
    try {
      // Build inputs for the enrichment function
      const inputs = parsedInputs.map(p => ({
        email: p.type === 'email' ? p.value : undefined,
        domain: p.type === 'domain' ? p.value : (p.domain || undefined),
        company_name: p.type === 'company_name' ? p.value : undefined,
        source_type: sourceType
      }));
      
      setProgress(20);
      
      // Use enrich-internal-first for both - it handles accounts and can be extended for leads
      const functionName = 'enrich-v4';
      
      // Pass ALL input fields to edge function for lead enrichment
      const leadInputs = enrichmentType === 'leads' ? parsedInputs.map(i => ({
        email: i.type === 'email' ? i.value : undefined,
        first_name: i.first_name,
        last_name: i.last_name,
        title: i.title,
        phone: i.phone,
        linkedin_url: i.linkedin_url,
        company: i.company || (i.type === 'company_name' ? i.value : undefined),
        domain: i.type === 'domain' ? i.value : (i.domain || undefined)
      })) : undefined;
      
      // Use async mode for large lead batches (10+ leads)
      const isLargeBatch = enrichmentType === 'leads' && parsedInputs.length >= 10;
      
      // Always send inputs array - use leadInputs for leads, regular inputs for accounts
      const enrichmentInputs = enrichmentType === 'leads' ? leadInputs : inputs;
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          inputs: enrichmentInputs,
          enrichment_type: enrichmentType,
          org_id: userProfile.org_id,
          source_type: sourceType,
          force_external: !checkInternalFirst,
          save_to_db: saveToDatabase,
          async_mode: isLargeBatch
        }
      });
      
      if (error) throw error;
      
      // Handle async job response
      if (data?.async && data?.job_id) {
        setActiveJobId(data.job_id);
        setStep("processing");
        setIsProcessing(false);
        toast.success(`Enrichment started for ${data.total_records} records`, {
          description: "Processing in background - you can navigate away"
        });
        return;
      }
      
      // Handle synchronous response
      setProgress(80);
      setResults(data.results || []);
      setStats(data.stats || {});
      setProgress(100);
      setStep("results");
      
      toast.success(`Enriched ${data.results?.length || 0} records`);
    } catch (error: any) {
      // Extract error from all possible Supabase error structures
      let errorMessage = 'Unknown error occurred';
      
      // Log EVERYTHING for debugging FIRST
      console.error("[Enrichment] === ERROR DEBUG ===");
      console.error("[Enrichment] Raw error:", error);
      console.error("[Enrichment] Error name:", error?.name);
      console.error("[Enrichment] Error type:", typeof error);
      console.error("[Enrichment] Error keys:", error ? Object.keys(error) : 'null');
      console.error("[Enrichment] Error context:", error?.context);
      console.error("[Enrichment] Error status:", error?.status);
      
      if (error) {
        // Check for FunctionsHttpError (404, 500, etc.) - shows as hex ID in error.name
        const isHexId = error.name && /^[a-f0-9]{32}$/i.test(error.name);
        const isFunctionsError = error.name === 'FunctionsHttpError' || 
                                  error.name === 'FunctionsRelayError' ||
                                  isHexId;
        
        if (isFunctionsError || error.status === 404) {
          errorMessage = 'Enrichment service is temporarily unavailable. Please try again in a few minutes.';
        } else if (error.status === 500 || error.status >= 500) {
          errorMessage = 'Enrichment service encountered an error. Our team has been notified.';
        }
        // Supabase function error structure - check context.body first
        else if (error.context?.body) {
          try {
            const body = JSON.parse(error.context.body);
            errorMessage = body.error || body.message || body.error_description || JSON.stringify(body);
          } catch {
            errorMessage = error.context.body;
          }
        } else if (error.message && !isHexId) {
          errorMessage = error.message;
        } else if (error.error_message) {
          errorMessage = error.error_message;
        } else if (error.error) {
          errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      }
      
      console.error("[Enrichment] Error message extracted:", errorMessage);
      
      toast.error(`Enrichment failed: ${errorMessage}`);
      setStep("preview");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to escape CSV values
  const escapeCsv = (value: string): string => {
    if (!value) return '';
    // Escape double quotes and wrap in quotes if contains special chars
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Validate email format - filter out corrupted values like "true"
  const safeEmail = (value: any, fallback?: string): string => {
    if (typeof value === 'string' && value.includes('@') && !value.includes(' ')) {
      return value;
    }
    return fallback || '';
  };

  // Validate phone format - filter out corrupted values
  // Validate phone number - filter out coordinates and garbage data
  const isValidPhoneNumber = (value: any): boolean => {
    if (!value) return false;
    const str = String(value).trim();
    const digits = str.replace(/\D/g, '');
    // Must be 7-15 digits
    if (digits.length < 7 || digits.length > 15) return false;
    // Reject decimals (coordinates like 117.3601186)
    if (str.includes('.') && /^\d+\.\d+$/.test(str)) return false;
    // Reject all same digit (1111111)
    if (/^(\d)\1+$/.test(digits)) return false;
    return true;
  };

  const safePhone = (value: any): string => {
    if (!value) return '';
    if (!isValidPhoneNumber(value)) return '';
    if (typeof value === 'string' && /[\d\-\+\(\)]/.test(value) && value.length >= 7) {
      return value;
    }
    return '';
  };

  // Clean 20-field essential headers (no internal metadata)
  const ESSENTIAL_HEADERS = [
    "Email", "First Name", "Last Name", "Title", 
    "Level", "Persona", "Phone", "Mobile", "Direct Phone",
    "Company", "Website", "Industry", "Employee Count", "Revenue Range",
    "Country", "State", "City", "LinkedIn URL", "Email Verified", "ICP Qualified"
  ];

  // Helper function to export leads to CSV (reusable for both local and DB results)
  const exportLeadsToCSV = (leadsResults: EnrichmentResult[], essentialOnly: boolean = false) => {

    // Build rows based on export type
    if (essentialOnly) {
      const rows = leadsResults.map((r) => {
        const d = r.enriched_data || {};
        const input = r.input || {};
        const email = safeEmail(d.email, input.email);
        const firstName = d.first_name || input.first_name || '';
        const lastName = d.last_name || input.last_name || '';
        const company = d.company || d.company_name || input.company || '';
        const title = d.title || d.title_raw || input.title || '';
        
        return [
          escapeCsv(email),
          escapeCsv(firstName),
          escapeCsv(lastName),
          escapeCsv(title),
          escapeCsv(d.level || ''),
          escapeCsv(d.persona || ''),
          escapeCsv(safePhone(d.phone) || safePhone(input.phone) || ''),
          escapeCsv(safePhone(d.mobile) || ''),
          escapeCsv(safePhone(d.direct_phone) || ''),
          escapeCsv(company),
          escapeCsv(d.website || d.domain || input.domain || ''),
          escapeCsv(d.industry || d.industry_norm || ''),
          d.employee_count?.toString() || '',
          escapeCsv(d.revenue_range || ''),
          escapeCsv(d.country || ''),
          escapeCsv(d.state_province || d.hq_state || ''),
          escapeCsv(d.location_city || d.hq_city || ''),
          escapeCsv(d.linkedin_url || input.linkedin_url || ''),
          d.email_verified ? 'true' : '',
          d.icp_qualified ? 'true' : ''
        ];
      });
      
      const csv = [ESSENTIAL_HEADERS.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enriched_leads_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${leadsResults.length} leads with 20 fields`);
      return;
    }

    // Full 27-field export (no internal metadata)
    const headers = [
      "Email", "First Name", "Last Name", "Name",
      "Title", "Level", "Persona",
      "Phone", "Mobile", "Direct Phone",
      "Company", "Website", "Industry", "Sub Industry",
      "Employee Count", "Revenue Range",
      "Country", "State", "City", "HQ Address",
      "LinkedIn URL",
      "Email Verified", "Email Status",
      "ICP Qualified", "ICP Fail Reasons",
      "Status", "Pipeline Stage"
    ];

    const rows = leadsResults.map((r) => {
      const d = r.enriched_data || {};
      const input = r.input || {};
      const firstName = d.first_name || input.first_name || '';
      const lastName = d.last_name || input.last_name || '';
      const email = safeEmail(d.email, input.email);
      const company = d.company || d.company_name || input.company || input.company_name || '';
      const title = d.title || d.title_raw || d.job_title || input.title || '';
      const level = d.level || '';
      const persona = d.persona || '';
      const primaryPhone = safePhone(d.phone) || safePhone(d.direct_phone) || safePhone(input.phone) || '';
      const mobilePhone = safePhone(d.mobile) || safePhone(d.cell_phone) || '';
      const directPhone = safePhone(d.direct_phone) || '';
      const hqCity = d.hq_city || d.location_city || d.city || '';
      const hqState = d.hq_state || d.state_province || '';
      const hqAddress = d.hq_address || '';
      
      return [
        escapeCsv(email),
        escapeCsv(firstName), escapeCsv(lastName),
        escapeCsv(d.name || `${firstName} ${lastName}`.trim() || ''),
        escapeCsv(title), escapeCsv(level), escapeCsv(persona),
        escapeCsv(primaryPhone), escapeCsv(mobilePhone), escapeCsv(directPhone),
        escapeCsv(company),
        escapeCsv(d.website || d.domain || input.domain || ''),
        escapeCsv(d.industry || d.industry_norm || d.industry_raw || ''),
        escapeCsv(d.sub_industry || ''),
        d.employee_count?.toString() || '', escapeCsv(d.revenue_range || ''),
        escapeCsv(d.country || ''), escapeCsv(hqState), escapeCsv(hqCity),
        escapeCsv(hqAddress),
        escapeCsv(d.linkedin_url || input.linkedin_url || ''),
        d.email_verified ? 'true' : '', escapeCsv(d.email_status || ''),
        d.icp_qualified ? 'true' : '',
        Array.isArray(d.icp_fail_reasons) ? escapeCsv(d.icp_fail_reasons.join('; ')) : '',
        escapeCsv(d.status || ''), escapeCsv(d.pipeline_stage || '')
      ];
    });
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enriched_leads_full_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${leadsResults.length} leads with ${headers.length} fields`);
  };

  // Export results to CSV - supports essential (25 fields) or full (34 fields)
  const exportResults = async (essentialOnly: boolean = false) => {
    // For background jobs with no local results, fetch from database
    if (results.length === 0) {
      if (!userProfile?.org_id) {
        toast.error("Unable to export - no organization found");
        return;
      }
      
      toast.info("Fetching leads from database...");
      
      // Fetch the most recent leads by updated_at (more reliable than enriched_at)
      const { data: leads, error } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('updated_at', { ascending: false })
        .limit(stats?.total || 100);
      
      if (error) {
        console.error('Export fetch error:', error);
        toast.error("Failed to fetch leads from database");
        return;
      }
      
      if (!leads?.length) {
        toast.error("No leads found. Try running enrichment first.");
        return;
      }
      
      // Convert DB leads to results format and export
      const dbResults: EnrichmentResult[] = leads.map(lead => ({
        input: { email: lead.email },
        enriched_data: lead,
        source: lead.enriched_from || 'database',
        confidence: lead.enrichment_confidence || 0,
        fields_filled: Object.keys(lead).filter(k => lead[k] != null)
      }));
      
      exportLeadsToCSV(dbResults, essentialOnly);
      return;
    }
    
    if (enrichmentType === 'leads') {
      exportLeadsToCSV(results, essentialOnly);
    } else {
      // Account export - 17 fields
      const headers = [
        'Input', 'Domain', 'Company Name',
        'Employee Count', 'Revenue Range', 'Industry', 'Sub Industry',
        'Country', 'State', 'City', 'HQ Address',
        'LinkedIn URL', 'Founded Year', 'Business Model',
        'Source', 'Confidence', 'Fields Filled'
      ];
      
      const rows = results.map(r => {
        const d = r.enriched_data;
        return [
          r.input.email || r.input.domain || r.input.company_name || '',
          d.domain || '',
          d.name || d.company || '',
          d.employee_count || '',
          d.revenue_range || '',
          d.industry_norm || d.industry || '',
          d.sub_industry || '',
          d.country || '',
          d.state_province || '',
          d.city || '',
          d.hq_address || '',
          d.linkedin_url || '',
          d.founded_year || '',
          d.business_model || '',
          r.source,
          Math.round(r.confidence * 100) + '%',
          r.fields_filled.join(', ')
        ];
      });
      
      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enriched_accounts_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${results.length} accounts to CSV`);
    }
  };

  // Reset wizard
  const reset = () => {
    setStep("type");
    setPasteInput("");
    setParsedInputs([]);
    setPreviewStats(null);
    setResults([]);
    setStats(null);
    setProgress(0);
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Enrich Data
        </CardTitle>
        <CardDescription>
          Enrich accounts or leads from any source - paste, upload, or select from database
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between px-2 mb-4">
          {["type", "input", "preview", "process", "results"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                step === s 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : ["type", "input", "preview", "process", "results"].indexOf(step) > i
                    ? "bg-primary/20 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-muted-foreground/30"
              }`}>
                {["type", "input", "preview", "process", "results"].indexOf(step) > i ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && (
                <div className={`w-8 sm:w-12 h-0.5 mx-1 ${
                  ["type", "input", "preview", "process", "results"].indexOf(step) > i
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Type */}
        {step === "type" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What would you like to enrich?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setEnrichmentType("accounts"); setStep("input"); }}
                className={`p-6 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                  enrichmentType === "accounts" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Building2 className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  Company data: employee count, revenue, industry, location
                </p>
              </button>
              
              <button
                onClick={() => { setEnrichmentType("leads"); setStep("input"); }}
                className={`p-6 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                  enrichmentType === "leads" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Users className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Leads/Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  People data: email verification, title, phone, LinkedIn
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Input Method */}
        {step === "input" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("type")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Badge variant="outline">
                {enrichmentType === "accounts" ? "Account Enrichment" : "Lead Enrichment"}
              </Badge>
            </div>
            
            <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as InputMethod)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="paste" className="gap-1">
                  <Search className="h-3 w-3" /> Paste
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-1">
                  <Upload className="h-3 w-3" /> Upload
                </TabsTrigger>
                <TabsTrigger value="existing" className="gap-1">
                  <Database className="h-3 w-3" /> Existing
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Paste emails, domains, or company names</Label>
                  <Textarea
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder={enrichmentType === "accounts" 
                      ? "microsoft.com\napple.com\nGoogle Inc.\njohn@acme.com"
                      : "john@microsoft.com\njane@apple.com\nsarah@google.com"
                    }
                    className="min-h-[150px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    One per line. We'll auto-detect the type and extract domains.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Data Source</Label>
                  <Select value={sourceType} onValueChange={setSourceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                      <SelectItem value="webinar">Webinar Attendees</SelectItem>
                      <SelectItem value="website_visitor">Website Visitors</SelectItem>
                      <SelectItem value="event">Event/Conference</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="crm_import">CRM Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={parseInput} disabled={!pasteInput.trim()} className="w-full">
                  Parse & Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </TabsContent>
              
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file?.name.endsWith('.csv')) handleFileUpload(file);
                  }}
                >
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium mb-1">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="csv-upload-wizard"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" asChild>
                    <label htmlFor="csv-upload-wizard" className="cursor-pointer">
                      Select File
                    </label>
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label>Data Source</Label>
                  <Select value={sourceType} onValueChange={setSourceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv_import">CSV Import</SelectItem>
                      <SelectItem value="webinar">Webinar Attendees</SelectItem>
                      <SelectItem value="event">Event/Conference</SelectItem>
                      <SelectItem value="crm_import">CRM Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              
              <TabsContent value="existing" className="space-y-4 mt-4">
                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    Enrich unenriched {enrichmentType} already in your database.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={async () => {
                    if (!userProfile?.org_id) return;
                    
                    const table = enrichmentType === 'accounts' ? 'accounts' : 'Leads';
                    const { data, count } = await supabase
                      .from(table)
                      .select('*', { count: 'exact' })
                      .eq('org_id', userProfile.org_id)
                      .is('enriched_at', null)
                      .limit(100);
                    
                    if (!data || data.length === 0) {
                      toast.info("No unenriched records found");
                      return;
                    }
                    
                    const parsed: ParsedInput[] = data.map((r: any) => ({
                      type: r.email ? 'email' as const : r.domain ? 'domain' as const : 'company_name' as const,
                      value: r.email || r.domain || r.name || r.company || '',
                      domain: r.domain
                    })).filter((p: ParsedInput) => p.value);
                    
                    setParsedInputs(parsed);
                    setPreviewStats({
                      total: parsed.length,
                      with_domain: parsed.filter(p => p.type === 'domain' || p.domain).length,
                      with_email: parsed.filter(p => p.type === 'email').length,
                      company_name_only: parsed.filter(p => p.type === 'company_name').length
                    });
                    setStep("preview");
                    toast.success(`Found ${count || parsed.length} unenriched records`);
                  }}
                  className="w-full"
                >
                  Find Unenriched {enrichmentType === 'accounts' ? 'Accounts' : 'Leads'}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && previewStats && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Badge variant="outline">{previewStats.total} records</Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{previewStats.with_domain + previewStats.with_email}</p>
                <p className="text-xs text-muted-foreground">With Domain</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{previewStats.with_email}</p>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                <p className="text-2xl font-bold text-amber-600">{previewStats.company_name_only}</p>
                <p className="text-xs text-muted-foreground">Need Domain</p>
              </div>
            </div>
            
            {previewStats.company_name_only > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {previewStats.company_name_only} records have company name only. 
                  We'll attempt to discover their domains automatically.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-3 border rounded-lg p-4">
              <h4 className="font-medium text-sm">Options</h4>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="check-internal" className="text-sm">Check internal data first</Label>
                <Switch
                  id="check-internal"
                  checked={checkInternalFirst}
                  onCheckedChange={setCheckInternalFirst}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="discover-domains" className="text-sm">Auto-discover domains for company names</Label>
                <Switch
                  id="discover-domains"
                  checked={discoverDomains}
                  onCheckedChange={setDiscoverDomains}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="save-db" className="text-sm">Save results to database</Label>
                <Switch
                  id="save-db"
                  checked={saveToDatabase}
                  onCheckedChange={setSaveToDatabase}
                />
              </div>
            </div>
            
            <Button onClick={startEnrichment} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Start Enrichment
            </Button>
          </div>
        )}

        {/* Step 4: Processing (sync) */}
        {step === "process" && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">Enriching {parsedInputs.length} records...</h3>
              <p className="text-sm text-muted-foreground">
                {progress < 20 ? "Preparing data..." : 
                 progress < 80 ? "Calling enrichment APIs..." : 
                 "Finalizing results..."}
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Step 4b: Processing (async with job monitor) */}
        {step === "processing" && activeJobId && (
          <div className="space-y-4">
            <EnrichmentProgressMonitor 
              jobId={activeJobId}
              onComplete={(job) => {
                console.log('[EnrichmentWizard] Job completed, full job data:', JSON.stringify(job, null, 2));
                console.log('[EnrichmentWizard] source_breakdown value:', job.source_breakdown);
                if (job.status === 'completed') {
                  setStep("results");
                  // Read source breakdown from job source_breakdown column (not metadata)
                  const breakdown = job.source_breakdown || {};
                  console.log('[EnrichmentWizard] Using breakdown:', breakdown);
                  setStats({
                    total: job.total_records || 0,
                    enriched: job.enriched_records || job.rows_completed || 0,
                    failed: job.failed_records || job.rows_failed || 0,
                    internal_matches: breakdown.internal_matches || 0,
                    apollo_enriched: breakdown.apollo_enriched || 0,
                    pdl_enriched: breakdown.pdl_enriched || 0,
                    ai_enriched: breakdown.ai_enriched || 0
                  });
                } else {
                  setStep("preview");
                }
                setActiveJobId(null);
              }}
              onClose={() => {
                // Allow user to dismiss and continue later
                setStep("type");
                setActiveJobId(null);
              }}
            />
            <p className="text-center text-sm text-muted-foreground">
              You can close this wizard - enrichment will continue in the background
            </p>
          </div>
        )}

        {/* Step 5: Results */}
        {step === "results" && stats && (
          <div className="space-y-4">
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Enrichment complete! {stats.enriched || results.filter(r => r.fields_filled.length > 0).length} of {stats.total || results.length} records enriched.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold">{stats.internal_matches || 0}</p>
                <p className="text-xs text-muted-foreground">Internal</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold">{(stats.apollo_enriched || 0) + (stats.pdl_enriched || 0)}</p>
                <p className="text-xs text-muted-foreground">API</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold">{stats.ai_enriched || 0}</p>
                <p className="text-xs text-muted-foreground">AI</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                <p className="text-xl font-bold text-amber-600">{stats.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            
            {stats.api_calls_saved > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                💰 Saved {stats.api_calls_saved} API calls by using internal data
              </p>
            )}
            
            {/* Sample results */}
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {results.slice(0, 5).map((r, i) => (
                <div key={i} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex-1 truncate">
                    {r.input.email || r.input.domain || r.input.company_name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {r.source}
                    </Badge>
                    <span className="text-muted-foreground">
                      {r.fields_filled.length} fields
                    </span>
                  </div>
                </div>
              ))}
              {results.length > 5 && (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  +{results.length - 5} more results
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => exportResults(true)} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Essential CSV (25 fields)
              </Button>
              <Button variant="outline" onClick={() => exportResults(false)} className="flex-1 gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Full CSV (34 fields)
              </Button>
            </div>
            <Button onClick={reset} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Enrich More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
