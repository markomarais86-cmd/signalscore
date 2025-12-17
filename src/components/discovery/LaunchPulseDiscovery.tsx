import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { ICPProfile } from '@/types/icp';
import { 
  Rocket, 
  Search, 
  Building2, 
  Globe, 
  Users, 
  DollarSign, 
  Check, 
  X,
  Loader2,
  TrendingUp,
  ExternalLink,
  Download
} from 'lucide-react';

interface DiscoveredCompany {
  name: string;
  domain: string;
  industry: string;
  employee_count: number;
  revenue_range: string;
  country: string;
  city?: string;
  description?: string;
  tech_stack?: string[];
  confidence: number;
  discovery_reason: string;
  selected?: boolean;
}

interface DiscoveryResult {
  success: boolean;
  mode: string;
  discovered_count: number;
  duplicates_filtered: number;
  imported_count?: number;
  companies: DiscoveredCompany[];
  search_summary: string;
}

interface LaunchPulseDiscoveryProps {
  icp?: ICPProfile;
  compact?: boolean;
}

export function LaunchPulseDiscovery({ icp, compact = false }: LaunchPulseDiscoveryProps) {
  const { userProfile } = useAuth();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  
  // Criteria state - initialize from ICP if provided
  const [keywords, setKeywords] = useState('');
  const [techStack, setTechStack] = useState('');
  const [limit, setLimit] = useState(20);

  // Derived criteria from ICP
  const industries = icp?.industries || [];
  const geographies = icp?.geographies || [];
  const companySizes = icp?.company_sizes || [];
  const revenueRanges = icp?.revenue_ranges || [];

  useEffect(() => {
    // Pre-populate tech stack from ICP if available
    if (icp?.tech_stack?.length) {
      setTechStack(icp.tech_stack.join(', '));
    }
  }, [icp]);

  const handleDiscover = async () => {
    if (!userProfile?.org_id) {
      toast.error('Organization not found');
      return;
    }

    if (industries.length === 0 && geographies.length === 0 && !keywords) {
      toast.error('Please select an ICP with criteria or add keywords');
      return;
    }

    setIsDiscovering(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-discover-accounts', {
        body: {
          org_id: userProfile.org_id,
          mode: 'preview',
          criteria: {
            industries,
            geographies,
            company_sizes: companySizes,
            revenue_ranges: revenueRanges,
            keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
            tech_stack: techStack.split(',').map(t => t.trim()).filter(Boolean),
            limit
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setResult(data);
        setSelectedCompanies(new Set(data.companies.map((c: DiscoveredCompany) => c.domain)));
        toast.success(`Found ${data.discovered_count} companies matching your ICP!`);
      } else {
        toast.error(data.error || 'Discovery failed');
      }
    } catch (err) {
      console.error('Discovery error:', err);
      toast.error('Failed to discover accounts');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleImport = async () => {
    if (!userProfile?.org_id || !result?.companies) return;

    const companiesToImport = result.companies.filter(c => selectedCompanies.has(c.domain));
    if (companiesToImport.length === 0) {
      toast.error('Select at least one company to import');
      return;
    }

    setIsImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-discover-accounts', {
        body: {
          org_id: userProfile.org_id,
          mode: 'import',
          criteria: {
            industries,
            geographies,
            company_sizes: companySizes,
            revenue_ranges: revenueRanges,
            keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
            tech_stack: techStack.split(',').map(t => t.trim()).filter(Boolean),
            limit: companiesToImport.length
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Imported ${data.imported_count} accounts to your pipeline!`);
        setResult(null);
        setSelectedCompanies(new Set());
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import accounts');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleCompany = (domain: string) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedCompanies(newSelected);
  };

  const selectAll = () => {
    if (result?.companies) {
      setSelectedCompanies(new Set(result.companies.map(c => c.domain)));
    }
  };

  const deselectAll = () => {
    setSelectedCompanies(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header - Only show if not compact */}
      {!compact && (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">LaunchPulse Discovery</h2>
            <p className="text-muted-foreground">
              Discover companies matching {icp ? `"${icp.name}"` : 'your ICP'} and add them to your pipeline
            </p>
          </div>
        </div>
      )}

      {/* ICP Criteria Summary */}
      {icp && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Discovery Criteria from "{icp.name}"
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              {industries.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Industries:</span>
                  <div className="flex flex-wrap gap-1">
                    {industries.slice(0, 3).map(i => (
                      <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                    ))}
                    {industries.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{industries.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}
              {geographies.length > 0 && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Regions:</span>
                  <div className="flex flex-wrap gap-1">
                    {geographies.slice(0, 3).map(g => (
                      <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                    ))}
                    {geographies.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{geographies.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}
              {companySizes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Sizes:</span>
                  <Badge variant="secondary" className="text-xs">{companySizes.length} ranges</Badge>
                </div>
              )}
              {revenueRanges.length > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Revenue:</span>
                  <Badge variant="secondary" className="text-xs">{revenueRanges.length} ranges</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Criteria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Additional Keywords</Label>
          <Input
            placeholder="cloud, automation, AI..."
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Tech Stack</Label>
          <Input
            placeholder="Salesforce, AWS, Snowflake..."
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Companies to find</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={5}
              max={50}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
            />
            <Button
              onClick={handleDiscover}
              disabled={isDiscovering}
            >
              {isDiscovering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Discovery Results
              </CardTitle>
              <CardDescription>
                {result ? `Found ${result.discovered_count} companies (${result.duplicates_filtered} duplicates filtered)` : 'Click discover to find matching companies'}
              </CardDescription>
            </div>
            {result && result.companies.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  <Check className="h-4 w-4 mr-1" />
                  All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  <X className="h-4 w-4 mr-1" />
                  None
                </Button>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={isImporting || selectedCompanies.size === 0}
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Import ({selectedCompanies.size})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!result && !isDiscovering && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No discovery results yet</p>
              <p className="text-sm">Click the rocket button to discover companies matching your ICP</p>
            </div>
          )}

          {isDiscovering && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Searching for companies...</p>
              <p className="text-sm text-muted-foreground">This may take 15-30 seconds</p>
            </div>
          )}

          {result && result.companies.length > 0 && (
            <>
              {result.search_summary && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <strong>Discovery Summary:</strong> {result.search_summary}
                </div>
              )}
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {result.companies.map((company) => (
                    <div
                      key={company.domain}
                      className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                        selectedCompanies.has(company.domain)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleCompany(company.domain)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedCompanies.has(company.domain)}
                          onCheckedChange={() => toggleCompany(company.domain)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold">{company.name}</h4>
                            <a
                              href={`https://${company.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {company.domain}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Badge variant="secondary" className="text-xs">
                              {company.confidence}% match
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {company.industry}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {company.employee_count.toLocaleString()} employees
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {company.revenue_range}
                            </span>
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {company.city ? `${company.city}, ` : ''}{company.country}
                            </span>
                          </div>

                          {company.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {company.description}
                            </p>
                          )}

                          {company.tech_stack && company.tech_stack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {company.tech_stack.slice(0, 5).map((tech, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <p className="text-xs text-primary/80 mt-2 italic">
                            {company.discovery_reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {result && result.companies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No new companies found</p>
              <p className="text-sm">Try adjusting your criteria or keywords</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
