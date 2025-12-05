import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  Zap, 
  X, 
  Calendar, 
  DollarSign, 
  Lightbulb,
  Shield,
  Code,
  FolderOpen
} from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { 
  COMPANY_STAGES,
  TECH_STACK,
  GROWTH_STAGES,
  FUNDING_STATUS,
  INTENT_SIGNALS,
  BUYING_TRIGGERS,
  SEASONAL_PATTERNS,
  BUDGET_INDICATORS,
  TIMEZONES
} from '@/constants/icp';

interface ICPWizardStep4Props {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
}

export function ICPWizardStep4({ formData, onUpdateFormData }: ICPWizardStep4Props) {
  const addToArray = (field: keyof ICPFormData, value: string) => {
    const currentArray = formData[field] as string[];
    if (!currentArray.includes(value)) {
      onUpdateFormData({
        [field]: [...currentArray, value]
      });
    }
  };

  const removeFromArray = (field: keyof ICPFormData, index: number) => {
    const currentArray = formData[field] as string[];
    onUpdateFormData({
      [field]: currentArray.filter((_, i) => i !== index)
    });
  };

  const addCustomValue = (field: keyof ICPFormData, value: string) => {
    if (value.trim()) {
      addToArray(field, value.trim());
    }
  };

  const handleCustomInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, field: keyof ICPFormData) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (value) {
        addCustomValue(field, value);
        e.currentTarget.value = '';
      }
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Advanced Targeting</h2>
          <p className="text-muted-foreground">
            Fine-tune your targeting with advanced criteria and signals
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Company Classification
            </CardTitle>
            <CardDescription>
              Target by company maturity and growth stage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Company Stages</Label>
                <ClearButton field="company_stages" count={formData.company_stages.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.company_stages.map((stage, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('company_stages', index)}>
                    {stage} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('company_stages', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add company stage" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_STAGES.filter(stage => !formData.company_stages.includes(stage)).map(stage => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Growth Stages</Label>
                <ClearButton field="growth_stage" count={formData.growth_stage.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.growth_stage.map((stage, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('growth_stage', index)}>
                    {stage} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('growth_stage', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add growth stage" />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_STAGES.filter(stage => !formData.growth_stage.includes(stage)).map(stage => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Funding Status</Label>
                <ClearButton field="funding_status" count={formData.funding_status.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.funding_status.map((status, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('funding_status', index)}>
                    {status} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('funding_status', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add funding status" />
                </SelectTrigger>
                <SelectContent>
                  {FUNDING_STATUS.filter(status => !formData.funding_status.includes(status)).map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Technology Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Technology Stack
            </CardTitle>
            <CardDescription>
              Target by existing technology and tools
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Tech Stack</Label>
                <ClearButton field="tech_stack" count={formData.tech_stack.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tech_stack.map((tech, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('tech_stack', index)}>
                    {tech} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('tech_stack', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add technology" />
                </SelectTrigger>
                <SelectContent>
                  {TECH_STACK.filter(tech => !formData.tech_stack.includes(tech)).map(tech => (
                    <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="mt-2"
                placeholder="Or add custom technology (press Enter)"
                onKeyPress={(e) => handleCustomInputKeyPress(e, 'tech_stack')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Buying Signals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Buying Signals
            </CardTitle>
            <CardDescription>
              Target based on intent and buying behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Intent Signals</Label>
                <ClearButton field="intent_signals" count={formData.intent_signals.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.intent_signals.map((signal, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('intent_signals', index)}>
                    {signal} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('intent_signals', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add intent signal" />
                </SelectTrigger>
                <SelectContent>
                  {INTENT_SIGNALS.filter(signal => !formData.intent_signals.includes(signal)).map(signal => (
                    <SelectItem key={signal} value={signal}>{signal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Buying Triggers</Label>
                <ClearButton field="buying_triggers" count={formData.buying_triggers.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.buying_triggers.map((trigger, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('buying_triggers', index)}>
                    {trigger} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('buying_triggers', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add buying trigger" />
                </SelectTrigger>
                <SelectContent>
                  {BUYING_TRIGGERS.filter(trigger => !formData.buying_triggers.includes(trigger)).map(trigger => (
                    <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Budget & Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Budget & Timing
            </CardTitle>
            <CardDescription>
              Target by budget cycles and seasonal patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Seasonal Patterns</Label>
                <ClearButton field="seasonal_patterns" count={formData.seasonal_patterns.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.seasonal_patterns.map((pattern, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('seasonal_patterns', index)}>
                    {pattern} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('seasonal_patterns', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add seasonal pattern" />
                </SelectTrigger>
                <SelectContent>
                  {SEASONAL_PATTERNS.filter(pattern => !formData.seasonal_patterns.includes(pattern)).map(pattern => (
                    <SelectItem key={pattern} value={pattern}>{pattern}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Budget Indicators</Label>
                <ClearButton field="budget_indicators" count={formData.budget_indicators.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.budget_indicators.map((indicator, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('budget_indicators', index)}>
                    {indicator} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('budget_indicators', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add budget indicator" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_INDICATORS.filter(indicator => !formData.budget_indicators.includes(indicator)).map(indicator => (
                    <SelectItem key={indicator} value={indicator}>{indicator}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Exclusion Criteria */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-orange-500" />
            Exclusion Criteria
          </CardTitle>
          <CardDescription>
            Define companies or industries to exclude from targeting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <Label>Excluded Industries</Label>
                <ClearButton field="excluded_industries" count={formData.excluded_industries.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.excluded_industries.map((industry, index) => (
                  <Badge key={index} variant="destructive" className="cursor-pointer" onClick={() => removeFromArray('excluded_industries', index)}>
                    {industry} ×
                  </Badge>
                ))}
              </div>
              <Input
                className="mt-2"
                placeholder="Add excluded industry (press Enter)"
                onKeyPress={(e) => handleCustomInputKeyPress(e, 'excluded_industries')}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Excluded Companies</Label>
                <ClearButton field="excluded_companies" count={formData.excluded_companies.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.excluded_companies.map((company, index) => (
                  <Badge key={index} variant="destructive" className="cursor-pointer" onClick={() => removeFromArray('excluded_companies', index)}>
                    {company} ×
                  </Badge>
                ))}
              </div>
              <Input
                className="mt-2"
                placeholder="Add excluded company (press Enter)"
                onKeyPress={(e) => handleCustomInputKeyPress(e, 'excluded_companies')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Advanced Targeting Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Use technographics to find companies already invested in complementary solutions</li>
            <li>• Intent signals help identify companies actively researching solutions</li>
            <li>• Buying triggers indicate companies with urgent need for change</li>
            <li>• Seasonal patterns help time your outreach for maximum impact</li>
            <li>• Exclusion criteria prevent wasted effort on unsuitable prospects</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}