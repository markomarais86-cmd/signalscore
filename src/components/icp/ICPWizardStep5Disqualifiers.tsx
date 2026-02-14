import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldX, X, Ban, Building, MapPin, Users } from 'lucide-react';
import { ICPFormData, ICPDisqualifiers } from '@/types/icp';
import { INDUSTRIES, COUNTRIES, COMPANY_SIZES } from '@/constants/icp';

interface ICPWizardStep5DisqualifiersProps {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
}

export function ICPWizardStep5Disqualifiers({ formData, onUpdateFormData }: ICPWizardStep5DisqualifiersProps) {
  const disqualifiers = formData.disqualifiers || {};

  const updateDisqualifiers = (updates: Partial<ICPDisqualifiers>) => {
    onUpdateFormData({
      disqualifiers: { ...disqualifiers, ...updates }
    });
  };

  const addToList = (key: keyof ICPDisqualifiers, value: string) => {
    const current = (disqualifiers[key] as string[]) || [];
    if (!current.includes(value)) {
      updateDisqualifiers({ [key]: [...current, value] });
    }
  };

  const removeFromList = (key: keyof ICPDisqualifiers, index: number) => {
    const current = (disqualifiers[key] as string[]) || [];
    updateDisqualifiers({ [key]: current.filter((_, i) => i !== index) });
  };

  const clearList = (key: keyof ICPDisqualifiers) => {
    updateDisqualifiers({ [key]: [] });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, key: keyof ICPDisqualifiers) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (value) {
        addToList(key, value);
        e.currentTarget.value = '';
      }
    }
  };

  const ClearButton = ({ listKey, count }: { listKey: keyof ICPDisqualifiers; count: number }) => {
    if (count === 0) return null;
    return (
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => clearList(listKey)}>
        <X className="h-3 w-3 mr-1" />Clear ({count})
      </Button>
    );
  };

  // Also update the legacy excluded fields for backwards compat
  const handleExcludedIndustry = (value: string) => {
    addToList('excluded_industries', value);
    const current = formData.excluded_industries || [];
    if (!current.includes(value)) {
      onUpdateFormData({ excluded_industries: [...current, value] });
    }
  };

  const handleExcludedCompany = (value: string) => {
    addToList('excluded_companies', value);
    const current = formData.excluded_companies || [];
    if (!current.includes(value)) {
      onUpdateFormData({ excluded_companies: [...current, value] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-destructive/10 rounded-lg">
          <ShieldX className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Disqualifiers</h2>
          <p className="text-muted-foreground">
            Define hard-no criteria — accounts matching these will be automatically excluded
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Excluded Industries */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-destructive" />
              Excluded Industries
            </CardTitle>
            <CardDescription>Industries that are never a fit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Industries</Label>
              <ClearButton listKey="excluded_industries" count={(disqualifiers.excluded_industries || []).length} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(disqualifiers.excluded_industries || []).map((ind, i) => (
                <Badge key={i} variant="destructive" className="cursor-pointer" onClick={() => removeFromList('excluded_industries', i)}>
                  {ind} ×
                </Badge>
              ))}
            </div>
            <Select onValueChange={handleExcludedIndustry}>
              <SelectTrigger><SelectValue placeholder="Add excluded industry" /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.filter(i => !(disqualifiers.excluded_industries || []).includes(i)).map(ind => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Excluded Geographies */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-destructive" />
              Excluded Geographies
            </CardTitle>
            <CardDescription>Regions or countries to exclude</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Geographies</Label>
              <ClearButton listKey="excluded_geographies" count={(disqualifiers.excluded_geographies || []).length} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(disqualifiers.excluded_geographies || []).map((geo, i) => (
                <Badge key={i} variant="destructive" className="cursor-pointer" onClick={() => removeFromList('excluded_geographies', i)}>
                  {geo} ×
                </Badge>
              ))}
            </div>
            <Select onValueChange={(v) => addToList('excluded_geographies', v)}>
              <SelectTrigger><SelectValue placeholder="Add excluded geography" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.filter(c => !(disqualifiers.excluded_geographies || []).includes(c)).map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Excluded Companies */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Excluded Companies
            </CardTitle>
            <CardDescription>Specific companies to always exclude</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Companies</Label>
              <ClearButton listKey="excluded_companies" count={(disqualifiers.excluded_companies || []).length} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(disqualifiers.excluded_companies || []).map((co, i) => (
                <Badge key={i} variant="destructive" className="cursor-pointer" onClick={() => removeFromList('excluded_companies', i)}>
                  {co} ×
                </Badge>
              ))}
            </div>
            <Input placeholder="Add company name (press Enter)" onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const v = e.currentTarget.value.trim();
                if (v) { handleExcludedCompany(v); e.currentTarget.value = ''; }
              }
            }} />
          </CardContent>
        </Card>

        {/* Hard No Criteria */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-destructive" />
              Hard No Criteria
            </CardTitle>
            <CardDescription>Custom disqualification rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Criteria</Label>
              <ClearButton listKey="hard_no_criteria" count={(disqualifiers.hard_no_criteria || []).length} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(disqualifiers.hard_no_criteria || []).map((c, i) => (
                <Badge key={i} variant="destructive" className="cursor-pointer" onClick={() => removeFromList('hard_no_criteria', i)}>
                  {c} ×
                </Badge>
              ))}
            </div>
            <Input placeholder="e.g., Government contracts only (press Enter)" onKeyPress={(e) => handleKeyPress(e, 'hard_no_criteria')} />
            <p className="text-xs text-muted-foreground">Free-text criteria that flag an account as a hard no</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
