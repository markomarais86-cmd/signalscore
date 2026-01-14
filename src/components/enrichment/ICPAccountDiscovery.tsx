import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Loader2, 
  Building2, 
  Globe, 
  Users, 
  HelpCircle,
  Import,
  Eye,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ICPProfile {
  id: string;
  name: string;
  target_industries: string[] | null;
  target_geographies: string[] | null;
  target_company_sizes: string[] | null;
  target_revenue_ranges: string[] | null;
}

interface DiscoveredCompany {
  name: string;
  domain: string;
  industry: string;
  employee_count: number;
  revenue_range: string;
  country: string;
  city?: string;
  description?: string;
  confidence: number;
  discovery_reason: string;
  selected?: boolean;
}

export function ICPAccountDiscovery() {
  const { userProfile } = useAuth();
  const [icpProfiles, setIcpProfiles] = useState<ICPProfile[]>([]);
  const [selectedIcpId, setSelectedIcpId] = useState<string>("");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [discoveredCompanies, setDiscoveredCompanies] = useState<DiscoveredCompany[]>([]);
  const [mode, setMode] = useState<"idle" | "preview" | "imported">("idle");
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadICPProfiles();
    }
  }, [userProfile?.org_id]);

  const loadICPProfiles = async () => {
    if (!userProfile?.org_id) return;

    const { data, error } = await supabase
      .from("icp_profiles")
      .select("*")
      .eq("org_id", userProfile.org_id)
      .eq("status", "active");

    if (error) {
      console.error("Error loading ICP profiles:", error);
      return;
    }

    const profiles = (data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      target_industries: d.target_industries,
      target_geographies: d.target_geographies,
      target_company_sizes: d.target_company_sizes,
      target_revenue_ranges: d.target_revenue_ranges
    }));
    setIcpProfiles(profiles);
    if (profiles.length > 0) {
      setSelectedIcpId(profiles[0].id);
    }
  };

  const discoverAccounts = async (previewOnly = true) => {
    if (!userProfile?.org_id || !selectedIcpId) return;

    const selectedIcp = icpProfiles.find(p => p.id === selectedIcpId);
    if (!selectedIcp) return;

    setLoading(true);
    setMode("idle");

    try {
      const { data, error } = await supabase.functions.invoke("ai-discover-accounts", {
        body: {
          org_id: userProfile.org_id,
          criteria: {
            industries: selectedIcp.target_industries || [],
            geographies: selectedIcp.target_geographies || [],
            company_sizes: selectedIcp.target_company_sizes || [],
            revenue_ranges: selectedIcp.target_revenue_ranges || [],
            keywords: [],
            limit
          },
          mode: previewOnly ? "preview" : "import"
        }
      });

      if (error) throw error;

      if (previewOnly) {
        const companies = (data.companies || []).map((c: DiscoveredCompany) => ({
          ...c,
          selected: true
        }));
        setDiscoveredCompanies(companies);
        setMode("preview");
        toast.success(`Found ${companies.length} matching companies`);
      } else {
        setImportedCount(data.imported_count || 0);
        setMode("imported");
        toast.success(`Imported ${data.imported_count} new accounts!`);
      }

    } catch (error: any) {
      console.error("Discovery error:", error);
      toast.error("Discovery failed", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (!userProfile?.org_id || !selectedIcpId) return;

    const selectedCompanies = discoveredCompanies.filter(c => c.selected);
    if (selectedCompanies.length === 0) {
      toast.warning("No companies selected");
      return;
    }

    setImporting(true);

    try {
      // Insert selected companies directly
      let imported = 0;
      for (const company of selectedCompanies) {
        const externalId = `ai_discovery_${company.domain?.replace(/\./g, '_')}_${Date.now()}`;
        
        const { error } = await supabase
          .from("accounts")
          .insert({
            org_id: userProfile.org_id,
            external_id: externalId,
            name: company.name,
            domain: company.domain?.toLowerCase().replace(/^www\./, ''),
            industry_raw: company.industry,
            industry_norm: company.industry,
            employee_count: company.employee_count,
            revenue_range: company.revenue_range,
            country: company.country,
            city: company.city,
            data_source: "ai_discovery",
            enrichment_confidence: company.confidence,
            trust_signals: {
              ai_discovery: true,
              discovery_reason: company.discovery_reason,
              discovered_at: new Date().toISOString()
            }
          });

        if (!error) imported++;
      }

      setImportedCount(imported);
      setMode("imported");
      toast.success(`Imported ${imported} new accounts!`);

    } catch (error: any) {
      toast.error("Import failed", { description: error.message });
    } finally {
      setImporting(false);
    }
  };

  const toggleCompany = (index: number) => {
    setDiscoveredCompanies(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  };

  const toggleAll = (selected: boolean) => {
    setDiscoveredCompanies(prev => prev.map(c => ({ ...c, selected })));
  };

  const selectedCount = discoveredCompanies.filter(c => c.selected).length;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Discover New Accounts
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center">
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs z-50">
                <p>Search the web for NEW companies that match your Ideal Customer Profile criteria. Uses AI to find and verify real companies.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            Find new companies that match your ICP and add them to your account list
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration */}
          {mode === "idle" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ICP Profile</Label>
                  <Select value={selectedIcpId} onValueChange={setSelectedIcpId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ICP..." />
                    </SelectTrigger>
                    <SelectContent>
                      {icpProfiles.map(icp => (
                        <SelectItem key={icp.id} value={icp.id}>
                          {icp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Number of companies</Label>
                    <span className="text-sm font-medium">{limit}</span>
                  </div>
                  <Slider
                    value={[limit]}
                    onValueChange={([v]) => setLimit(v)}
                    min={10}
                    max={100}
                    step={10}
                  />
                </div>
              </div>

              {icpProfiles.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No active ICP profiles found. Please create an ICP profile first.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={() => discoverAccounts(true)}
                  disabled={loading || !selectedIcpId}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Preview Companies
                </Button>
              </div>
            </>
          )}

          {/* Preview Results */}
          {mode === "preview" && discoveredCompanies.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {discoveredCompanies.length} companies found
                  </Badge>
                  <Badge variant="outline">
                    {selectedCount} selected
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-80 rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="w-20">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discoveredCompanies.map((company, idx) => (
                      <TableRow key={idx} className={company.selected ? "" : "opacity-50"}>
                        <TableCell>
                          <Checkbox
                            checked={company.selected}
                            onCheckedChange={() => toggleCompany(idx)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{company.name}</p>
                            <p className="text-xs text-muted-foreground">{company.domain}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{company.industry}</TableCell>
                        <TableCell className="text-sm">
                          {company.employee_count?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {company.city ? `${company.city}, ` : ""}{company.country}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={company.confidence >= 80 ? "default" : "secondary"}
                            className={company.confidence >= 80 ? "bg-green-500" : ""}
                          >
                            {company.confidence}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode("idle");
                    setDiscoveredCompanies([]);
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={importSelected}
                  disabled={importing || selectedCount === 0}
                  className="flex-1"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4 mr-2" />
                  )}
                  Import {selectedCount} Companies
                </Button>
              </div>
            </>
          )}

          {/* Success State */}
          {mode === "imported" && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              <div>
                <p className="text-xl font-bold">{importedCount} Accounts Imported!</p>
                <p className="text-muted-foreground">
                  New accounts are now in your account list and ready for enrichment.
                </p>
              </div>
              <Button
                onClick={() => {
                  setMode("idle");
                  setDiscoveredCompanies([]);
                  setImportedCount(0);
                }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Discover More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
