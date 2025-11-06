import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, DollarSign, Target, Building2, Settings, RotateCcw, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useMemo } from "react";

interface TAMSegment {
  label: string;
  accounts: number;
  value: number;
  percentage: number;
  description: string;
  color: string;
}

interface TAMSAMSOMCalculatorProps {
  totalAccounts: number;
  highFitAccounts: number;
  campaignReadyAccounts: number;
  averageDealSize?: number;
  conversionRate?: number;
}

interface TAMAssumptions {
  averageDealSize: number;
  conversionRate: number;
  timeHorizon: number;
  highFitThreshold: number;
}

const DEFAULT_ASSUMPTIONS: TAMAssumptions = {
  averageDealSize: 75000,
  conversionRate: 0.15,
  timeHorizon: 12,
  highFitThreshold: 70
};

export function TAMSAMSOMCalculator({
  totalAccounts,
  highFitAccounts,
  campaignReadyAccounts,
  averageDealSize: propAverageDealSize,
  conversionRate: propConversionRate
}: TAMSAMSOMCalculatorProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [assumptions, setAssumptions] = useState<TAMAssumptions>(() => {
    // Load from localStorage
    const stored = localStorage.getItem('tam_assumptions');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_ASSUMPTIONS;
      }
    }
    return {
      ...DEFAULT_ASSUMPTIONS,
      averageDealSize: propAverageDealSize || DEFAULT_ASSUMPTIONS.averageDealSize,
      conversionRate: propConversionRate || DEFAULT_ASSUMPTIONS.conversionRate
    };
  });

  const [editingAssumptions, setEditingAssumptions] = useState<TAMAssumptions>(assumptions);

  // Save to localStorage whenever assumptions change
  useEffect(() => {
    localStorage.setItem('tam_assumptions', JSON.stringify(assumptions));
  }, [assumptions]);

  const isCustomAssumptions = useMemo(() => {
    return JSON.stringify(assumptions) !== JSON.stringify(DEFAULT_ASSUMPTIONS);
  }, [assumptions]);

  const handleSave = () => {
    setAssumptions(editingAssumptions);
    setIsEditMode(false);
  };

  const handleReset = () => {
    setEditingAssumptions(DEFAULT_ASSUMPTIONS);
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setEditingAssumptions(assumptions);
    setIsEditMode(false);
  };

  // TAM: Total Addressable Market - ALL accounts in database
  const tamAccounts = totalAccounts;
  const tamValue = tamAccounts * assumptions.averageDealSize;

  // SAM: Serviceable Addressable Market - Accounts matching ICP (high fit)
  // Adjust based on custom threshold (proportional estimation)
  const samAccounts = useMemo(() => {
    if (assumptions.highFitThreshold === 70) {
      return highFitAccounts;
    }
    // Estimate: higher threshold = fewer accounts
    const thresholdFactor = (90 - assumptions.highFitThreshold) / (90 - 70);
    return Math.round(highFitAccounts * thresholdFactor);
  }, [highFitAccounts, assumptions.highFitThreshold]);

  const samValue = samAccounts * assumptions.averageDealSize;
  const samPercentage = totalAccounts > 0 ? (samAccounts / tamAccounts) * 100 : 0;

  // SOM: Serviceable Obtainable Market - Campaign ready (high fit + contacts)
  // Adjust based on time horizon
  const somAccounts = campaignReadyAccounts;
  const timeAdjustedConversion = assumptions.conversionRate * (assumptions.timeHorizon / 12);
  const somValue = somAccounts * assumptions.averageDealSize * timeAdjustedConversion;
  const somPercentage = samAccounts > 0 ? (somAccounts / samAccounts) * 100 : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatCurrencyInput = (value: number) => {
    return value.toLocaleString('en-US');
  };

  const parseCurrencyInput = (value: string) => {
    return parseInt(value.replace(/,/g, '')) || 0;
  };

  const segments: TAMSegment[] = [
    {
      label: "TAM",
      accounts: tamAccounts,
      value: tamValue,
      percentage: 100,
      description: "Total Addressable Market - All accounts in database",
      color: "hsl(var(--chart-1))"
    },
    {
      label: "SAM",
      accounts: samAccounts,
      value: samValue,
      percentage: samPercentage,
      description: "Serviceable Addressable Market - Accounts matching ICP criteria",
      color: "hsl(var(--chart-2))"
    },
    {
      label: "SOM",
      accounts: somAccounts,
      value: somValue,
      percentage: somPercentage,
      description: `Serviceable Obtainable Market - ${assumptions.timeHorizon}-month target`,
      color: "hsl(var(--chart-3))"
    }
  ];

  const getMarketHealthColor = (percentage: number) => {
    if (percentage >= 60) return "text-[hsl(var(--signal-high))]";
    if (percentage >= 30) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              TAM/SAM/SOM Analysis
              {isCustomAssumptions && (
                <Badge variant="outline" className="ml-2">
                  Custom
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Market opportunity sizing based on ICP fit and campaign readiness
            </CardDescription>
          </div>
          <Collapsible open={isEditMode} onOpenChange={setIsEditMode}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Edit Assumptions
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isEditMode ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Assumptions Editor */}
          <Collapsible open={isEditMode}>
            <CollapsibleContent>
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Average Deal Size */}
                  <div className="space-y-2">
                    <Label htmlFor="dealSize" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Average Deal Size
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="dealSize"
                        type="text"
                        value={formatCurrencyInput(editingAssumptions.averageDealSize)}
                        onChange={(e) => {
                          const value = parseCurrencyInput(e.target.value);
                          if (value >= 1000 && value <= 10000000) {
                            setEditingAssumptions({ ...editingAssumptions, averageDealSize: value });
                          }
                        }}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your average contract value ($1K - $10M)
                    </p>
                  </div>

                  {/* Time Horizon */}
                  <div className="space-y-2">
                    <Label htmlFor="timeHorizon" className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Time Horizon
                    </Label>
                    <Select
                      value={editingAssumptions.timeHorizon.toString()}
                      onValueChange={(value) => setEditingAssumptions({ 
                        ...editingAssumptions, 
                        timeHorizon: parseInt(value) 
                      })}
                    >
                      <SelectTrigger id="timeHorizon">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 months</SelectItem>
                        <SelectItem value="12">12 months</SelectItem>
                        <SelectItem value="18">18 months</SelectItem>
                        <SelectItem value="24">24 months</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Sales cycle timeframe
                    </p>
                  </div>

                  {/* Conversion Rate */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Conversion Rate: {(editingAssumptions.conversionRate * 100).toFixed(0)}%
                    </Label>
                    <Slider
                      value={[editingAssumptions.conversionRate * 100]}
                      onValueChange={(value) => setEditingAssumptions({ 
                        ...editingAssumptions, 
                        conversionRate: value[0] / 100 
                      })}
                      min={1}
                      max={50}
                      step={1}
                      className="py-4"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expected % of accounts that will close in timeframe (1% - 50%)
                    </p>
                  </div>

                  {/* High-Fit Threshold */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      High-Fit Threshold: {editingAssumptions.highFitThreshold}
                    </Label>
                    <Slider
                      value={[editingAssumptions.highFitThreshold]}
                      onValueChange={(value) => setEditingAssumptions({ 
                        ...editingAssumptions, 
                        highFitThreshold: value[0] 
                      })}
                      min={50}
                      max={90}
                      step={5}
                      className="py-4"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum ICP score to include in SAM (50 - 90)
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <Button onClick={handleSave} size="sm">
                    Save Assumptions
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    Cancel
                  </Button>
                  <Button onClick={handleReset} variant="ghost" size="sm" className="ml-auto">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Market Size Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                {formatCurrency(tamValue)}
              </div>
              <div className="text-sm text-muted-foreground">Total Market (TAM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {tamAccounts.toLocaleString()} accounts
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--chart-2))]">
                {formatCurrency(samValue)}
              </div>
              <div className="text-sm text-muted-foreground">Serviceable (SAM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {samAccounts.toLocaleString()} high-fit
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--chart-3))]">
                {formatCurrency(somValue)}
              </div>
              <div className="text-sm text-muted-foreground">Obtainable (SOM)</div>
              <div className="text-xs text-muted-foreground mt-1">
                {somAccounts.toLocaleString()} ready
              </div>
            </div>
          </div>

          {/* Market Funnel Visualization */}
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={segment.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      style={{ borderColor: segment.color, color: segment.color }}
                    >
                      {segment.label}
                    </Badge>
                    <span className="text-sm font-medium">{segment.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold" style={{ color: segment.color }}>
                        {formatCurrency(segment.value)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {segment.accounts.toLocaleString()} accounts
                      </div>
                    </div>
                    {index > 0 && (
                      <div className={`text-sm font-medium ${getMarketHealthColor(segment.percentage)}`}>
                        {segment.percentage.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={segment.percentage}
                  className="h-3"
                  style={{
                    // @ts-ignore
                    '--progress-background': segment.color
                  }}
                />
                
                {index === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Methodology: Bottom-up calculation based on actual database accounts
                  </div>
                )}
                {index === 1 && (
                  <div className="text-xs text-muted-foreground">
                    {samPercentage.toFixed(0)}% of TAM matches your ICP criteria (score ≥ {assumptions.highFitThreshold})
                  </div>
                )}
                {index === 2 && (
                  <div className="text-xs text-muted-foreground">
                    Assumes {(assumptions.conversionRate * 100).toFixed(0)}% conversion rate over {assumptions.timeHorizon} months
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Key Insights */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />
              <span className="font-medium">Market Opportunity:</span>
              <span className="text-muted-foreground">
                {samPercentage >= 50 
                  ? "Strong ICP match - majority of accounts are high-fit"
                  : samPercentage >= 30
                  ? "Good targeting - significant addressable market"
                  : "Consider refining ICP or expanding data sources"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-[hsl(var(--chart-3))]" />
              <span className="font-medium">{assumptions.timeHorizon}-Month Target:</span>
              <span className="text-muted-foreground">
                {formatCurrency(somValue)} from {somAccounts} campaign-ready accounts
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-[hsl(var(--chart-2))]" />
              <span className="font-medium">Campaign Readiness:</span>
              <span className="text-muted-foreground">
                {somPercentage.toFixed(0)}% of high-fit accounts have contact data
              </span>
            </div>
          </div>

          {/* Assumptions Summary */}
          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="font-medium flex items-center gap-2">
                {isCustomAssumptions ? "Custom Assumptions:" : "Assumptions:"}
                {isCustomAssumptions && (
                  <Badge variant="secondary" className="text-xs">
                    Modified
                  </Badge>
                )}
              </div>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Average Deal Size: {formatCurrency(assumptions.averageDealSize)}</li>
                <li>{assumptions.timeHorizon}-Month Conversion Rate: {(assumptions.conversionRate * 100).toFixed(0)}%</li>
                <li>High-fit defined as ICP match score ≥ {assumptions.highFitThreshold}</li>
                <li>Campaign ready = High-fit + valid contact data</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}