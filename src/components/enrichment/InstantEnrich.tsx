import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Building2, 
  Users, 
  DollarSign, 
  MapPin, 
  Globe, 
  Linkedin,
  Phone,
  Copy,
  Save,
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Flame,
  Pencil,
  Lock,
  X,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface EnrichedCompany {
  name: string;
  domain: string;
  employee_count: number | null;
  revenue_range: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  linkedin_url: string | null;
  phone: string | null;
  founded_year: number | null;
  tech_stack: string[] | null;
  funding_round: string | null;
  total_raised: number | null;
  confidence: number;
  source: string;
}

type EditableField = "employee_count" | "revenue_range" | "industry" | "city" | "country";

interface ManuallyVerified {
  [key: string]: boolean;
}

export function InstantEnrich() {
  const { userProfile } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichedCompany | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [useFirecrawl, setUseFirecrawl] = useState(true);
  
  // Editing state
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [manuallyVerified, setManuallyVerified] = useState<ManuallyVerified>({});

  const isDomain = query.includes('.') && !query.includes(' ');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setManuallyVerified({});

    try {
      if (useFirecrawl && isDomain) {
        const { data, error: fnError } = await supabase.functions.invoke("enrich-unified", {
          body: { 
            domain: query.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
            companyName: query.trim().split('.')[0]
          }
        });

        if (fnError) throw fnError;

        if (data.error) {
          console.log("Firecrawl failed, falling back to AI search:", data.error);
          return await searchWithAI();
        } else {
          setResult(data.company);
        }
      } else {
        await searchWithAI();
      }
    } catch (err) {
      console.error("Enrichment error:", err);
      setError("Unable to find company information. Please try a different search.");
    } finally {
      setLoading(false);
    }
  };

  const searchWithAI = async () => {
    const { data, error: fnError } = await supabase.functions.invoke("enrich-unified", {
      body: { query: query.trim() }
    });

    if (fnError) throw fnError;

    if (data.error) {
      setError(data.error);
    } else {
      setResult(data.company);
    }
  };

  const startEditing = (field: EditableField, currentValue: string | number | null) => {
    setEditingField(field);
    setEditValue(currentValue?.toString() || "");
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = () => {
    if (!result || !editingField) return;

    const updatedResult = { ...result };
    
    if (editingField === "employee_count") {
      updatedResult.employee_count = editValue ? parseInt(editValue, 10) : null;
    } else {
      (updatedResult as any)[editingField] = editValue || null;
    }

    setResult(updatedResult);
    setManuallyVerified(prev => ({ ...prev, [editingField]: true }));
    setEditingField(null);
    setEditValue("");
    toast.success(`${editingField.replace("_", " ")} updated and locked`);
  };

  const handleSave = async () => {
    if (!result || !userProfile?.org_id) return;

    try {
      const externalId = `instant_${result.domain?.replace(/[^a-z0-9]/gi, "_") || Date.now()}`;

      const { error: insertError } = await supabase
        .from("accounts")
        .upsert({
          external_id: externalId,
          org_id: userProfile.org_id,
          name: result.name,
          domain: result.domain,
          employee_count: result.employee_count,
          revenue_range: result.revenue_range,
          industry_raw: result.industry,
          country: result.country,
          city: result.city,
          linkedin_url: result.linkedin_url,
          phone: result.phone,
          founded_year: result.founded_year,
          tech_stack: result.tech_stack,
          last_funding_round: result.funding_round,
          total_raised_usd: result.total_raised,
          enriched_at: new Date().toISOString(),
          enriched_from: "instant_enrich",
          enrichment_confidence: result.confidence / 100,
          manually_verified: Object.keys(manuallyVerified).length > 0 ? manuallyVerified : null,
        }, {
          onConflict: "external_id,org_id"
        });

      if (insertError) throw insertError;

      setSaved(true);
      toast.success("Company saved to your accounts!");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save company");
    }
  };

  const handleCopy = () => {
    if (!result) return;
    
    const text = `
${result.name}
Domain: ${result.domain || "N/A"}
Employees: ${result.employee_count?.toLocaleString() || "N/A"}
Revenue: ${result.revenue_range || "N/A"}
Industry: ${result.industry || "N/A"}
Location: ${[result.city, result.country].filter(Boolean).join(", ") || "N/A"}
LinkedIn: ${result.linkedin_url || "N/A"}
    `.trim();

    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleExport = () => {
    if (!result) return;

    const csv = [
      ["Name", "Domain", "Employees", "Revenue", "Industry", "Country", "City", "LinkedIn", "Phone"],
      [
        result.name,
        result.domain || "",
        result.employee_count?.toString() || "",
        result.revenue_range || "",
        result.industry || "",
        result.country || "",
        result.city || "",
        result.linkedin_url || "",
        result.phone || ""
      ]
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.name?.replace(/\s+/g, "_") || "company"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">High Confidence</Badge>;
    } else if (confidence >= 50) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Medium Confidence</Badge>;
    }
    return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Low Confidence</Badge>;
  };

  const renderEditableField = (
    field: EditableField,
    label: string,
    value: string | number | null,
    icon: React.ReactNode,
    formatValue?: (val: any) => string
  ) => {
    const isEditing = editingField === field;
    const isVerified = manuallyVerified[field];
    const displayValue = formatValue ? formatValue(value) : (value?.toString() || "—");

    return (
      <div className="p-3 rounded-lg border bg-background group relative">
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-sm mb-1">
          <div className="flex items-center gap-2">
            {icon}
            {label}
          </div>
          {isVerified && (
            <Lock className="h-3 w-3 text-primary" />
          )}
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEditing();
              }}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing}>
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className={`text-xl font-semibold ${field === "industry" || field === "city" || field === "country" ? "text-base" : ""}`}>
              {displayValue}
            </p>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => startEditing(field, value)}
              title="Edit value"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-primary" />
          Instant Company Lookup
        </CardTitle>
        <CardDescription>
          Search any company by name or website and get detailed information instantly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enrichment Mode Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <Label htmlFor="firecrawl-mode" className="text-sm font-medium">
              Website Scraping {isDomain && "(Recommended)"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {useFirecrawl ? "More accurate" : "AI search"}
            </span>
            <Switch
              id="firecrawl-mode"
              checked={useFirecrawl}
              onCheckedChange={setUseFirecrawl}
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter company domain (e.g., thepipelinegroup.io)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 h-12 text-base"
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={loading || !query.trim()}
            size="lg"
            className="h-12 px-6 gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4 p-6 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4 p-6 rounded-lg border bg-gradient-to-br from-background to-muted/30">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{result.name}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="text-sm">{result.domain}</span>
                    {result.domain && (
                      <a 
                        href={`https://${result.domain}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getConfidenceBadge(result.confidence)}
                <Badge variant="outline" className="text-xs">
                  via {result.source === "apollo" ? "Premium" : result.source === "ai" ? "AI Research" : result.source}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Editable hint */}
            {Object.keys(manuallyVerified).length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Pencil className="h-3 w-3" />
                Hover over any field to edit incorrect values
              </p>
            )}

            {/* Key Metrics - Now Editable */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {renderEditableField(
                "employee_count",
                "Employees",
                result.employee_count,
                <Users className="h-3.5 w-3.5" />,
                (val) => val?.toLocaleString() || "—"
              )}
              {renderEditableField(
                "revenue_range",
                "Revenue",
                result.revenue_range,
                <DollarSign className="h-3.5 w-3.5" />
              )}
              {renderEditableField(
                "industry",
                "Industry",
                result.industry,
                <Building2 className="h-3.5 w-3.5" />
              )}
              <div className="p-3 rounded-lg border bg-background group relative">
                <div className="flex items-center justify-between gap-2 text-muted-foreground text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </div>
                  {(manuallyVerified.city || manuallyVerified.country) && (
                    <Lock className="h-3 w-3 text-primary" />
                  )}
                </div>
                <p className="text-base font-medium truncate">
                  {[result.city, result.country].filter(Boolean).join(", ") || "—"}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3"
                  onClick={() => startEditing("city", result.city)}
                  title="Edit city"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.linkedin_url && (
                <a 
                  href={result.linkedin_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Linkedin className="h-4 w-4 text-[#0077B5]" />
                  <span className="text-sm">LinkedIn Profile</span>
                  <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                </a>
              )}
              {result.phone && (
                <a 
                  href={`tel:${result.phone}`}
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Phone className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{result.phone}</span>
                </a>
              )}
              {result.founded_year && (
                <div className="flex items-center gap-2 p-3 rounded-lg border">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Founded in {result.founded_year}</span>
                </div>
              )}
              {result.funding_round && (
                <div className="flex items-center gap-2 p-3 rounded-lg border">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {result.funding_round}
                    {result.total_raised && ` • $${(result.total_raised / 1000000).toFixed(1)}M raised`}
                  </span>
                </div>
              )}
            </div>

            {/* Tech Stack */}
            {result.tech_stack && result.tech_stack.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Tech Stack</p>
                <div className="flex flex-wrap gap-2">
                  {result.tech_stack.slice(0, 10).map((tech, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                  {result.tech_stack.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{result.tech_stack.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Verified fields indicator */}
            {Object.keys(manuallyVerified).length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3 text-primary" />
                <span>
                  {Object.keys(manuallyVerified).length} field(s) manually verified - these won't be overwritten during re-enrichment
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saved} className="gap-2">
                {saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save to Accounts
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCopy} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !result && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Enter a company name or domain to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
