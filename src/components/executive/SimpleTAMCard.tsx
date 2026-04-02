import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, TrendingUp, Settings, BarChart3, Sparkles } from "lucide-react";

interface SimpleTAMCardProps {
  tamValue?: number;
  totalAccounts: number;
  highFitAccounts: number;
  medFitAccounts?: number;
  campaignReadyAccounts: number;
  averageDealSize?: number;
  conversionRate?: number;
  className?: string;
  onSettingsChange?: (settings: { averageDealSize: number; conversionRate: number }) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(1)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function SimpleTAMCard({
  tamValue,
  totalAccounts,
  highFitAccounts,
  medFitAccounts = 0,
  campaignReadyAccounts,
  averageDealSize: initialDealSize = 75000,
  conversionRate: initialConversion = 0.15,
  className,
  onSettingsChange,
}: SimpleTAMCardProps) {
  const navigate = useNavigate();
  const averageDealSize = initialDealSize;
  const conversionRate = initialConversion;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempDealSize, setTempDealSize] = useState(initialDealSize);
  const [tempConversion, setTempConversion] = useState(initialConversion * 100);
  const [viewMode, setViewMode] = useState<"funnel" | "highlight">("highlight");

  // Sync temp values when props change (after DB save)
  useEffect(() => {
    setTempDealSize(initialDealSize);
  }, [initialDealSize]);
  useEffect(() => {
    setTempConversion(initialConversion * 100);
  }, [initialConversion]);

  const handleSaveSettings = () => {
    setIsSettingsOpen(false);
    onSettingsChange?.({ averageDealSize: tempDealSize, conversionRate: tempConversion / 100 });
  };

  // TAM: ICP-Fit Market (high-fit + medium-fit accounts)
  const tamAccounts = highFitAccounts + medFitAccounts;
  const calculatedTAM = tamValue && tamValue > 0 ? tamValue : tamAccounts * averageDealSize;

  // SAM: Serviceable Addressable Market
  const samAccounts = highFitAccounts;
  const samValue = samAccounts * averageDealSize;
  const samPercentage = tamAccounts > 0 ? (samAccounts / tamAccounts) * 100 : 0;

  // SOM: Serviceable Obtainable Market
  const somAccounts = campaignReadyAccounts;
  const somValue = somAccounts * averageDealSize * conversionRate;
  const somPercentage = samAccounts > 0 ? (somAccounts / samAccounts) * 100 : 0;

  const segments = [
    {
      label: "TAM",
      sublabel: "ICP-Fit Market",
      value: calculatedTAM,
      accounts: tamAccounts,
      percentage: 100,
      color: "hsl(161 85% 60%)",
    },
    {
      label: "SAM",
      sublabel: "Serviceable",
      value: samValue,
      accounts: samAccounts,
      percentage: samPercentage,
      color: "hsl(43 96% 56%)",
    },
    {
      label: "SOM",
      sublabel: "Obtainable",
      value: somValue,
      accounts: somAccounts,
      percentage: somPercentage,
      color: "hsl(0 0% 75%)",
    },
  ];

  return (
    <Card className={`${className} floating-card border-border/30 bg-card/90 backdrop-blur-xl shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500`}>
      <CardContent className="p-6">
        {/* Header with View Toggle and Settings */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Market Sizing</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "funnel" | "highlight")}>
              <TabsList className="h-7 bg-muted/50">
                <TabsTrigger value="highlight" className="text-xs h-6 px-2">
                  <Sparkles className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="funnel" className="text-xs h-6 px-2">
                  <BarChart3 className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-3">TAM/SAM/SOM Settings</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Adjust these values to match your business model.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="dealSize" className="text-xs">Average Deal Size ($)</Label>
                      <Input
                        id="dealSize"
                        type="number"
                        value={tempDealSize}
                        onChange={(e) => setTempDealSize(Number(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="conversion" className="text-xs">Conversion Rate (%)</Label>
                      <Input
                        id="conversion"
                        type="number"
                        min="1"
                        max="100"
                        value={tempConversion}
                        onChange={(e) => setTempConversion(Number(e.target.value))}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setIsSettingsOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveSettings} className="flex-1">
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {viewMode === "highlight" ? (
          /* Highlight View - Big TAM Value */
          <div className="text-center py-4">
            <p className="text-6xl font-bold tracking-tight gradient-text mb-2">
              {formatCurrency(calculatedTAM)}
            </p>
            <p className="text-sm text-muted-foreground mb-6">Total Addressable Market</p>
            
            {/* Mini metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className="p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/accounts?fit=high")}
              >
                <p className="text-xl font-bold text-foreground">{formatCurrency(samValue)}</p>
                <p className="text-xs text-muted-foreground">SAM ({samPercentage.toFixed(0)}%)</p>
              </div>
              <div
                className="p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/accounts?fit=high&enriched=true")}
              >
                <p className="text-xl font-bold text-foreground">{formatCurrency(somValue)}</p>
                <p className="text-xs text-muted-foreground">SOM ({somPercentage.toFixed(0)}%)</p>
              </div>
            </div>
          </div>
        ) : (
          /* Funnel View */
          <>
            {/* TAM/SAM/SOM Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {segments.map((segment) => (
                <div
                  key={segment.label}
                  className="text-center cursor-pointer hover:bg-muted/30 rounded-lg p-1 transition-colors"
                  onClick={() => navigate("/accounts?fit=high")}
                >
                  <p 
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: segment.color }}
                  >
                    {formatCurrency(segment.value)}
                  </p>
                  <p className="text-xs font-medium text-foreground mt-1">{segment.label}</p>
                  <p className="text-xs text-muted-foreground">{segment.accounts.toLocaleString()} accounts</p>
                </div>
              ))}
            </div>

            {/* Visual Funnel */}
            <div className="space-y-3">
              {segments.map((segment, index) => (
                <div key={segment.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{segment.sublabel}</span>
                    {index > 0 && (
                      <span className="font-medium" style={{ color: segment.color }}>
                        {segment.percentage.toFixed(0)}% of {index === 1 ? 'TAM' : 'SAM'}
                      </span>
                    )}
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${segment.percentage}%`,
                        backgroundColor: segment.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Key Insight */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span>
              {samPercentage >= 50 
                ? "Strong ICP alignment - high market opportunity"
                : samPercentage >= 25 
                  ? "Moderate ICP fit - consider refining criteria"
                  : "Low ICP coverage - review targeting strategy"
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}