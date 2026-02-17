import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Building, Users, DollarSign, MapPin, Lightbulb, Target as TargetIcon, Sparkles, X, Settings } from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { INDUSTRIES, SUB_INDUSTRIES, COMPANY_SIZES, REVENUE_RANGES, COUNTRIES, REGIONS } from '@/constants/icp';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { formatNumber } from '@/utils/format-numbers';
import { useNavigate } from 'react-router-dom';

interface ICPWizardStep2Props {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
}

export function ICPWizardStep2({ formData, onUpdateFormData }: ICPWizardStep2Props) {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState('');
  
  // Load custom attribute definitions for vertical targeting
  const { data: customAttributes } = useQuery<any[]>({
    queryKey: ['custom-attribute-definitions', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from('custom_attribute_definitions' as any)
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('category', { ascending: true });
      if (error) { console.error('Error loading custom attributes:', error); return []; }
      return (data as any[]) || [];
    },
    enabled: !!effectiveOrgId,
  });
  
  // Real-time match count query
  const { data: matchCount } = useQuery<{ total: number; percentage: number; total_accounts: number } | null>({
    queryKey: ['icp-match-count', effectiveOrgId, formData.industries, formData.company_sizes, formData.revenue_ranges, formData.geographies, formData.company_keywords],
    queryFn: async () => {
      if (!effectiveOrgId) return null;
      
      const { data, error } = await supabase.rpc('estimate_icp_matches', {
        p_org_id: effectiveOrgId,
        p_industries: formData.industries.length > 0 ? formData.industries : null,
        p_sizes: formData.company_sizes.length > 0 ? formData.company_sizes : null,
        p_revenues: formData.revenue_ranges.length > 0 ? formData.revenue_ranges : null,
        p_countries: formData.geographies.length > 0 ? formData.geographies : null,
        p_company_keywords: formData.company_keywords.length > 0 ? formData.company_keywords : null
      });
      
      if (error) {
        console.error('Error fetching match count:', error);
        return null;
      }
      
      return data as { total: number; percentage: number; total_accounts: number };
    },
    enabled: !!effectiveOrgId && (
      formData.industries.length > 0 ||
      formData.company_sizes.length > 0 ||
      formData.revenue_ranges.length > 0 ||
      formData.geographies.length > 0 ||
      formData.company_keywords.length > 0
    ),
    staleTime: 30000
  });
  
  const addToArray = (field: keyof ICPFormData, value: string | number) => {
    const currentArray = formData[field] as any[];
    if (!currentArray.includes(value)) {
      onUpdateFormData({
        [field]: [...currentArray, value]
      });
    }
  };

  const removeFromArray = (field: keyof ICPFormData, index: number) => {
    const currentArray = formData[field] as any[];
    onUpdateFormData({
      [field]: currentArray.filter((_, i) => i !== index)
    });
  };

  const clearArray = (field: keyof ICPFormData) => {
    onUpdateFormData({ [field]: [] });
  };

  const ClearButton = ({ field, count }: { field: keyof ICPFormData; count: number }) => {
    if (count === 0) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => clearArray(field)}
      >
        <X className="h-3 w-3 mr-1" />
        Clear ({count})
      </Button>
    );
  };

  const getAvailableSubIndustries = () => {
    const allSubIndustries: string[] = [];
    formData.industries.forEach(industry => {
      if (SUB_INDUSTRIES[industry as keyof typeof SUB_INDUSTRIES]) {
        allSubIndustries.push(...SUB_INDUSTRIES[industry as keyof typeof SUB_INDUSTRIES]);
      }
    });
    return allSubIndustries.filter(sub => !formData.sub_industries.includes(sub));
  };

  const getAvailableRegionCountries = () => {
    const allCountries: string[] = [];
    formData.regions.forEach(region => {
      if (REGIONS[region as keyof typeof REGIONS]) {
        allCountries.push(...REGIONS[region as keyof typeof REGIONS]);
      }
    });
    return allCountries.filter(country => !formData.geographies.includes(country));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Building className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Company Targeting</h2>
          <p className="text-muted-foreground">
            Define the firmographic characteristics of your ideal customers
          </p>
        </div>
      </div>

      {/* Real-Time Match Count Preview */}
      {matchCount && matchCount.total > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TargetIcon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Estimated Match Size</span>
              </div>
              <div className="text-4xl font-bold text-primary">
                {formatNumber(matchCount.total)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                accounts match your criteria ({matchCount.percentage}% of {formatNumber(matchCount.total_accounts)} total)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Industry & Vertical
            </CardTitle>
            <CardDescription>
              Target specific industries and sub-verticals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Industries</Label>
                <ClearButton field="industries" count={formData.industries.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.industries.map((industry, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('industries', index)}>
                    {industry} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('industries', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.filter(i => !formData.industries.includes(i)).map(industry => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Sub-Industries</Label>
                <ClearButton field="sub_industries" count={formData.sub_industries.length} />
              </div>
              {formData.industries.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Select industries above first to see relevant sub-industries
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.sub_industries.map((subIndustry, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('sub_industries', index)}>
                    {subIndustry} ×
                  </Badge>
                ))}
              </div>
              <Select 
                onValueChange={(value) => addToArray('sub_industries', value)}
                disabled={formData.industries.length === 0}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={formData.industries.length === 0 ? "Select industries first" : "Add sub-industry"} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSubIndustries().map(subIndustry => (
                    <SelectItem key={subIndustry} value={subIndustry}>{subIndustry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.industries.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Showing sub-industries from: {formData.industries.join(', ')}
                </p>
              )}
            </div>

            {/* Company Keywords */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Company Keywords</Label>
                <ClearButton field="company_keywords" count={formData.company_keywords.length} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Free-text keywords matched against company industry, sub-industry, and name (e.g., "electrophysiology", "remote patient monitoring")
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.company_keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('company_keywords', index)}>
                    {keyword} ×
                  </Badge>
                ))}
              </div>
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keywordInput.trim()) {
                    e.preventDefault();
                    addToArray('company_keywords', keywordInput.trim());
                    setKeywordInput('');
                  }
                }}
                placeholder="Type keyword and press Enter"
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Company Size
            </CardTitle>
            <CardDescription>
              Target companies by employee count
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Company Sizes (employees)</Label>
                <ClearButton field="company_sizes" count={formData.company_sizes.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.company_sizes.map((size, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('company_sizes', index)}>
                    {size}+ ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('company_sizes', parseInt(value))}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add company size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.filter(s => !formData.company_sizes.includes(s)).map(size => (
                    <SelectItem key={size} value={size.toString()}>{size}+ employees</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Range
            </CardTitle>
            <CardDescription>
              Target companies by annual revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Revenue Ranges</Label>
                <ClearButton field="revenue_ranges" count={formData.revenue_ranges.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.revenue_ranges.map((range, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('revenue_ranges', index)}>
                    {range} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('revenue_ranges', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add revenue range" />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_RANGES.filter(r => !formData.revenue_ranges.includes(r)).map(range => (
                    <SelectItem key={range} value={range}>{range}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geographic Targeting
            </CardTitle>
            <CardDescription>
              Target specific regions and countries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Regions</Label>
                <ClearButton field="regions" count={formData.regions.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.regions.map((region, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('regions', index)}>
                    {region} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('regions', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add region" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(REGIONS).filter(r => !formData.regions.includes(r)).map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Countries</Label>
                <ClearButton field="geographies" count={formData.geographies.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.geographies.map((country, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('geographies', index)}>
                    {country} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('geographies', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.filter(c => !formData.geographies.includes(c)).map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.regions.length > 0 && (
              <div>
                <Label>Quick Add from Selected Regions</Label>
                <Select onValueChange={(value) => addToArray('geographies', value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Add countries from regions" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRegionCountries().map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vertical Attributes Card */}
      {customAttributes && customAttributes.length > 0 ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Vertical Attributes
            </CardTitle>
            <CardDescription>
              Industry-specific targeting criteria — AI providers will search for this data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const grouped = customAttributes.reduce<Record<string, any[]>>((acc, attr) => {
                const cat = attr.category || 'General';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(attr);
                return acc;
              }, {});

              return Object.entries(grouped).map(([category, attrs]) => (
                <div key={category} className="space-y-3">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{category}</Label>
                  {attrs.map((attr: any) => {
                    const verticalFilters = formData.vertical_filters || {};
                    
                    if (attr.field_type === 'number') {
                      return (
                        <div key={attr.field_key} className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">{attr.field_label} (min)</Label>
                            <Input
                              type="number"
                              value={verticalFilters[`${attr.field_key}_min`] || ''}
                              onChange={(e) => onUpdateFormData({
                                vertical_filters: {
                                  ...verticalFilters,
                                  [`${attr.field_key}_min`]: e.target.value ? Number(e.target.value) : undefined,
                                }
                              })}
                              placeholder="Min"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">{attr.field_label} (max)</Label>
                            <Input
                              type="number"
                              value={verticalFilters[`${attr.field_key}_max`] || ''}
                              onChange={(e) => onUpdateFormData({
                                vertical_filters: {
                                  ...verticalFilters,
                                  [`${attr.field_key}_max`]: e.target.value ? Number(e.target.value) : undefined,
                                }
                              })}
                              placeholder="Max"
                            />
                          </div>
                        </div>
                      );
                    }

                    if (attr.field_type === 'select' || attr.field_type === 'multi_select') {
                      const selectedValues: string[] = verticalFilters[attr.field_key] || [];
                      return (
                        <div key={attr.field_key}>
                          <Label className="text-sm">{attr.field_label}</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedValues.map((val: string) => (
                              <Badge key={val} variant="secondary" className="cursor-pointer" onClick={() => {
                                onUpdateFormData({
                                  vertical_filters: {
                                    ...verticalFilters,
                                    [attr.field_key]: selectedValues.filter((v: string) => v !== val),
                                  }
                                });
                              }}>
                                {val} ×
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(attr.options || []).filter((o: string) => !selectedValues.includes(o)).map((option: string) => (
                              <Button
                                key={option}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => {
                                  onUpdateFormData({
                                    vertical_filters: {
                                      ...verticalFilters,
                                      [attr.field_key]: [...selectedValues, option],
                                    }
                                  });
                                }}
                              >
                                + {option}
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // text type
                    return (
                      <div key={attr.field_key}>
                        <Label className="text-sm">{attr.field_label}</Label>
                        <Input
                          value={verticalFilters[attr.field_key] || ''}
                          onChange={(e) => onUpdateFormData({
                            vertical_filters: {
                              ...verticalFilters,
                              [attr.field_key]: e.target.value || undefined,
                            }
                          })}
                          placeholder={`Enter ${attr.field_label.toLowerCase()}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-6 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No vertical attributes defined</p>
            <p className="text-xs text-muted-foreground mt-1">
              Define custom fields like "bed count" or "facility type" to enable industry-specific targeting
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/settings?tab=custom-attributes')}>
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Set Up in Settings
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Targeting Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Start broad with industries, then narrow down with sub-industries</li>
            <li>• Consider both company size and revenue - they don't always correlate</li>
            <li>• Use regions for quick geographic selection, then add specific countries</li>
            <li>• Define vertical attributes in Settings to target industry-specific criteria like bed count or facility type</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}