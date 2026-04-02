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
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
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

  const tamAccounts = highFitAccounts + medFitAccounts;
  const calculatedTAM = tamValue && tamValue > 0 ? tamValue : tamAccounts * averageDealSize;
  const samAccounts = highFitAccounts;
  const samValue = samAccounts * averageDealSize;
  const samPercentage = tamAccounts > 0 ? (samAccounts / tamAccounts) * 100 : 0;
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
      color: "hsl(var(--primary))",
    },
    {
      label: "SAM",
      sublabel: "Serviceable",
      value: samValue,
      accounts: samAccounts,
      percentage: samPercentage,
      color: "hsl(var(--fit-medium))",
    },
    {
      label: "SOM",
      sublabel: "Obtainable",
      value: somValue,
      accounts: somAccounts,
      percentage: somPercentage,
      color: "hsl(var(--muted-foreground))",
    },
  ];

  return (
    <Card className={`${className ?? ""} border bg-card shadow-sm`}>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Market Sizing</h3>
              <p className="text-xs text-muted-foreground">TAM, SAM, and SOM based on your scored market.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "funnel" | "highlight")}>
              <TabsList className="h-8 bg-muted p-1">
                <TabsTrigger value="highlight" className="h-6 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Sparkles className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="funnel" className="h-6 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <BarChart3 className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium">TAM/SAM/SOM Settings</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Adjust these values to match your commercial model.
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-6 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Total Addressable Market</p>
              <p className="mt-3 text-5xl font-semibold tracking-tight font-mono text-primary lg:text-6xl">
                {formatCurrency(calculatedTAM)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{tamAccounts.toLocaleString()} ICP-fit accounts in scope</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-xl border bg-muted/10 px-4 py-4 text-left transition-colors hover:bg-muted/20"
                onClick={() => navigate("/accounts?fit=high")}
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">SAM</p>
                <p className="mt-2 text-2xl font-semibold font-mono text-foreground">{formatCurrency(samValue)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{samPercentage.toFixed(0)}% of TAM</p>
              </button>
              <button
                type="button"
                className="rounded-xl border bg-muted/10 px-4 py-4 text-left transition-colors hover:bg-muted/20"
                onClick={() => navigate("/accounts?fit=high&enriched=true")}
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">SOM</p>
                <p className="mt-2 text-2xl font-semibold font-mono text-foreground">{formatCurrency(somValue)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{somPercentage.toFixed(0)}% of SAM</p>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {segments.map((segment) => (
                <button
                  key={segment.label}
                  type="button"
                  className="rounded-xl border bg-muted/10 px-4 py-4 text-left transition-colors hover:bg-muted/20"
                  onClick={() => navigate("/accounts?fit=high")}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{segment.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight font-mono" style={{ color: segment.color }}>
                    {formatCurrency(segment.value)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{segment.accounts.toLocaleString()} accounts</p>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {segments.map((segment, index) => (
                <div key={segment.label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{segment.sublabel}</span>
                    <span className="font-medium" style={{ color: segment.color }}>
                      {index === 0 ? "100% of TAM" : `${segment.percentage.toFixed(0)}% of ${index === 1 ? "TAM" : "SAM"}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${segment.percentage}%`, backgroundColor: segment.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-5 border-t pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span>
              {totalAccounts === 0
                ? "No accounts available for market sizing yet."
                : samPercentage >= 50
                  ? "Strong ICP alignment — your serviceable market is concentrated and actionable."
                  : samPercentage >= 25
                    ? "Moderate ICP concentration — there is opportunity to sharpen targeting."
                    : "Low ICP concentration — revisit qualification to improve focus."}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
