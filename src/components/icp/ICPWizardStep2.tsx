import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building, Users, DollarSign, MapPin, Lightbulb, Target as TargetIcon, Sparkles, X } from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { INDUSTRIES, SUB_INDUSTRIES, COMPANY_SIZES, REVENUE_RANGES, COUNTRIES, REGIONS } from '@/constants/icp';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatNumber } from '@/utils/format-numbers';

interface ICPWizardStep2Props {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
}

export function ICPWizardStep2({ formData, onUpdateFormData }: ICPWizardStep2Props) {
  const { userProfile } = useAuth();
  
  // Real-time match count query
  const { data: matchCount } = useQuery<{ total: number; percentage: number; total_accounts: number } | null>({
    queryKey: ['icp-match-count', userProfile?.org_id, formData.industries, formData.company_sizes, formData.revenue_ranges, formData.geographies],
    queryFn: async () => {
      if (!userProfile?.org_id) return null;
      
      const { data, error } = await supabase.rpc('estimate_icp_matches', {
        p_org_id: userProfile.org_id,
        p_industries: formData.industries.length > 0 ? formData.industries : null,
        p_sizes: formData.company_sizes.length > 0 ? formData.company_sizes : null,
        p_revenues: formData.revenue_ranges.length > 0 ? formData.revenue_ranges : null,
        p_countries: formData.geographies.length > 0 ? formData.geographies : null
      });
      
      if (error) {
        console.error('Error fetching match count:', error);
        return null;
      }
      
      return data as { total: number; percentage: number; total_accounts: number };
    },
    enabled: !!userProfile?.org_id && (
      formData.industries.length > 0 ||
      formData.company_sizes.length > 0 ||
      formData.revenue_ranges.length > 0 ||
      formData.geographies.length > 0
    ),
    staleTime: 1000 // Refresh every second for real-time feel
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
            <li>• Mix different criteria to find the sweet spot for your solution</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}