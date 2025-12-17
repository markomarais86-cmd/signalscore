import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sparkles, 
  Search, 
  Building2, 
  Globe, 
  Users, 
  DollarSign, 
  Plus, 
  Check, 
  X,
  Loader2,
  TrendingUp,
  MapPin,
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

const INDUSTRIES = [
  'Technology', 'Software', 'SaaS', 'Financial Services', 'Healthcare',
  'Manufacturing', 'Retail', 'E-commerce', 'Education', 'Energy',
  'Logistics', 'Real Estate', 'Media', 'Telecommunications', 'Professional Services'
];

const COMPANY_SIZES = [
  '1-50 employees', '51-200 employees', '201-500 employees',
  '501-1000 employees', '1001-5000 employees', '5000+ employees'
];

const REVENUE_RANGES = [
  '<$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M',
  '$50M-$100M', '$100M-$250M', '$250M-$500M', '$500M-$1B', '$1B+'
];

const GEOGRAPHIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France',
  'Australia', 'Japan', 'Singapore', 'Netherlands', 'Sweden'
];

export function AIAccountDiscovery() {
  const { userProfile } = useAuth();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  
  // Criteria state
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedRevenues, setSelectedRevenues] = useState<string[]>([]);
  const [selectedGeographies, setSelectedGeographies] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [techStack, setTechStack] = useState('');
  const [limit, setLimit] = useState(20);

  const toggleSelection = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleDiscover = async () => {
    if (!userProfile?.org_id) {
      toast.error('Organization not found');
      return;
    }

    if (selectedIndustries.length === 0 && selectedGeographies.length === 0 && !keywords) {
      toast.error('Please select at least one criteria');
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
            industries: selectedIndustries,
            geographies: selectedGeographies,
            company_sizes: selectedSizes,
            revenue_ranges: selectedRevenues,
            keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
            tech_stack: techStack.split(',').map(t => t.trim()).filter(Boolean),
            limit
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setResult(data);
        // Select all by default
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
            industries: selectedIndustries,
            geographies: selectedGeographies,
            company_sizes: selectedSizes,
            revenue_ranges: selectedRevenues,
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">AI Account Discovery</h2>
          <p className="text-muted-foreground">
            Use AI to discover companies matching your ICP and add them to your pipeline
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Criteria Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Discovery Criteria
            </CardTitle>
            <CardDescription>
              Define your Ideal Customer Profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Industries */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Industries
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRIES.map(ind => (
                  <Badge
                    key={ind}
                    variant={selectedIndustries.includes(ind) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSelection(selectedIndustries, ind, setSelectedIndustries)}
                  >
                    {ind}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Geographies */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Geographies
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {GEOGRAPHIES.map(geo => (
                  <Badge
                    key={geo}
                    variant={selectedGeographies.includes(geo) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSelection(selectedGeographies, geo, setSelectedGeographies)}
                  >
                    {geo}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Company Sizes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Company Size
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {COMPANY_SIZES.map(size => (
                  <Badge
                    key={size}
                    variant={selectedSizes.includes(size) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSelection(selectedSizes, size, setSelectedSizes)}
                  >
                    {size}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Revenue Ranges */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue Range
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {REVENUE_RANGES.map(rev => (
                  <Badge
                    key={rev}
                    variant={selectedRevenues.includes(rev) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSelection(selectedRevenues, rev, setSelectedRevenues)}
                  >
                    {rev}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label>Keywords (comma-separated)</Label>
              <Input
                placeholder="cloud, automation, AI..."
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>

            {/* Tech Stack */}
            <div className="space-y-2">
              <Label>Tech Stack (comma-separated)</Label>
              <Input
                placeholder="Salesforce, AWS, Snowflake..."
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
              />
            </div>

            {/* Limit */}
            <div className="space-y-2">
              <Label>Number of companies to find</Label>
              <Input
                type="number"
                min={5}
                max={50}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              />
            </div>

            {/* Discover Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleDiscover}
              disabled={isDiscovering}
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Discover Companies
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Discovery Results
                </CardTitle>
                <CardDescription>
                  {result ? `Found ${result.discovered_count} companies (${result.duplicates_filtered} duplicates filtered)` : 'Run discovery to see results'}
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
                <p className="text-sm">Configure your ICP criteria and click "Discover Companies"</p>
              </div>
            )}

            {isDiscovering && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">AI is searching for companies...</p>
                <p className="text-sm text-muted-foreground">This may take 15-30 seconds</p>
              </div>
            )}

            {result && result.companies.length > 0 && (
              <>
                {result.search_summary && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                    <strong>AI Summary:</strong> {result.search_summary}
                  </div>
                )}
                <ScrollArea className="h-[500px]">
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
                                <MapPin className="h-3 w-3" />
                                {company.city ? `${company.city}, ` : ''}{company.country}
                              </span>
                            </div>

                            {company.description && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {company.description}
                              </p>
                            )}

                            {company.tech_stack && company.tech_stack.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {company.tech_stack.slice(0, 5).map(tech => (
                                  <Badge key={tech} variant="outline" className="text-xs">
                                    {tech}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <p className="mt-2 text-xs text-muted-foreground italic">
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
                <p className="text-sm">All discovered companies are already in your database, or criteria was too specific</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
