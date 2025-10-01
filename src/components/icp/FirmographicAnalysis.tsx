import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useFirmographicAnalysis } from '@/hooks/use-firmographic-analysis';
import { Building2, Users, DollarSign, Globe, Layers } from 'lucide-react';

interface FirmographicAnalysisProps {
  onCreateICP?: () => void;
}

export function FirmographicAnalysis({ onCreateICP }: FirmographicAnalysisProps) {
  const { loading, analysis, analyzeFirmographics, createICPFromAnalysis } = useFirmographicAnalysis();
  const [icpName, setIcpName] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedRevenues, setSelectedRevenues] = useState<string[]>([]);
  const [selectedGeographies, setSelectedGeographies] = useState<string[]>([]);
  const [selectedSubIndustries, setSelectedSubIndustries] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!analysis) {
      analyzeFirmographics();
    }
  }, []);

  const handleCreateICP = async () => {
    if (!icpName.trim()) {
      return;
    }

    setCreating(true);
    const result = await createICPFromAnalysis(
      icpName,
      selectedIndustries,
      selectedSizes,
      selectedRevenues,
      selectedGeographies,
      selectedSubIndustries
    );
    setCreating(false);

    if (result && onCreateICP) {
      onCreateICP();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analysis?.success || !analysis.analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Account Data</CardTitle>
          <CardDescription>
            Upload your account data first to create ICPs based on firmographic patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={analyzeFirmographics}>Retry Analysis</Button>
        </CardContent>
      </Card>
    );
  }

  const { analysis: data } = analysis;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Firmographic Analysis</CardTitle>
          <CardDescription>
            Analyzed {data.total_accounts.toLocaleString()} accounts to identify patterns
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Industries */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Top Industries</CardTitle>
            </div>
            <CardDescription>Select industries to target</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.industries.slice(0, 10).map((industry) => (
              <div key={industry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIndustries.includes(industry.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIndustries([...selectedIndustries, industry.name]);
                      } else {
                        setSelectedIndustries(selectedIndustries.filter(i => i !== industry.name));
                      }
                    }}
                  />
                  <Label className="cursor-pointer">{industry.name}</Label>
                </div>
                <Badge variant="secondary">
                  {industry.count} ({industry.percentage}%)
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sub-Industries */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              <CardTitle>Sub-Industries</CardTitle>
            </div>
            <CardDescription>Refine your targeting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {data.sub_industries.slice(0, 15).map((subIndustry) => (
              <div key={subIndustry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSubIndustries.includes(subIndustry.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSubIndustries([...selectedSubIndustries, subIndustry.name]);
                      } else {
                        setSelectedSubIndustries(selectedSubIndustries.filter(i => i !== subIndustry.name));
                      }
                    }}
                  />
                  <Label className="cursor-pointer text-sm">{subIndustry.name}</Label>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {subIndustry.count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Company Sizes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Company Sizes</CardTitle>
            </div>
            <CardDescription>Select employee count ranges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.company_sizes.map((size) => (
              <div key={size.size} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSizes.includes(size.size)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSizes([...selectedSizes, size.size]);
                      } else {
                        setSelectedSizes(selectedSizes.filter(s => s !== size.size));
                      }
                    }}
                  />
                  <Label className="cursor-pointer">{size.size} employees</Label>
                </div>
                <Badge variant="secondary">
                  {size.count} ({size.percentage}%)
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Revenue Ranges */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <CardTitle>Revenue Ranges</CardTitle>
            </div>
            <CardDescription>Select revenue targets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.revenue_ranges.map((revenue) => (
              <div key={revenue.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedRevenues.includes(revenue.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRevenues([...selectedRevenues, revenue.name]);
                      } else {
                        setSelectedRevenues(selectedRevenues.filter(r => r !== revenue.name));
                      }
                    }}
                  />
                  <Label className="cursor-pointer">{revenue.name}</Label>
                </div>
                <Badge variant="secondary">
                  {revenue.count} ({revenue.percentage}%)
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Geographies */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>Top Geographies</CardTitle>
            </div>
            <CardDescription>Select target countries/regions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {data.geographies.slice(0, 15).map((geo) => (
                <div key={geo.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedGeographies.includes(geo.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedGeographies([...selectedGeographies, geo.name]);
                        } else {
                          setSelectedGeographies(selectedGeographies.filter(g => g !== geo.name));
                        }
                      }}
                    />
                    <Label className="cursor-pointer">{geo.name}</Label>
                  </div>
                  <Badge variant="secondary">
                    {geo.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create ICP Section */}
      <Card>
        <CardHeader>
          <CardTitle>Create Your ICP</CardTitle>
          <CardDescription>
            Name your ICP and it will be created with the selected firmographic criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="icp-name">ICP Name</Label>
            <Input
              id="icp-name"
              placeholder="e.g., Enterprise Financial Services"
              value={icpName}
              onChange={(e) => setIcpName(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIndustries.length > 0 && (
              <Badge variant="outline">{selectedIndustries.length} industries</Badge>
            )}
            {selectedSubIndustries.length > 0 && (
              <Badge variant="outline">{selectedSubIndustries.length} sub-industries</Badge>
            )}
            {selectedSizes.length > 0 && (
              <Badge variant="outline">{selectedSizes.length} company sizes</Badge>
            )}
            {selectedRevenues.length > 0 && (
              <Badge variant="outline">{selectedRevenues.length} revenue ranges</Badge>
            )}
            {selectedGeographies.length > 0 && (
              <Badge variant="outline">{selectedGeographies.length} geographies</Badge>
            )}
          </div>
          <Button
            onClick={handleCreateICP}
            disabled={
              creating ||
              !icpName.trim() ||
              (selectedIndustries.length === 0 &&
                selectedSizes.length === 0 &&
                selectedRevenues.length === 0 &&
                selectedGeographies.length === 0)
            }
            className="w-full"
          >
            {creating ? 'Creating ICP...' : 'Create ICP from Selection'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
