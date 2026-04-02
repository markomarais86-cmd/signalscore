import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Settings, BarChart3, Sparkles } from "lucide-react";

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

  useEffect(() => { setTempDealSize(initialDealSize); }, [initialDealSize]);
  useEffect(() => { setTempConversion(initialConversion * 100); }, [initialConversion]);

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
    { label: "TAM", sublabel: "ICP-Fit Market", value: calculatedTAM, accounts: tamAccounts, percentage: 100, color: "hsl(var(--primary))" },
    { label: "SAM", sublabel: "Serviceable", value: samValue, accounts: samAccounts, percentage: samPercentage, color: "hsl(var(--fit-medium))" },
    { label: "SOM", sublabel: "Obtainable", value: somValue, accounts: somAccounts, percentage: somPercentage, color: "hsl(var(--muted-foreground))" },
  ];

  return (
    <Card className={`${className ?? ""} border bg-card`}>
      <CardContent className="p-5">
        {/* Controls */}
        <div className="mb-4 flex items-center justify-end gap-1.5">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "funnel" | "highlight")}>
            <TabsList className="h-7 bg-muted/50 p-0.5">
              <TabsTrigger value="highlight" className="h-6 px-2 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Sparkles className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="funnel" className="h-6 px-2 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <BarChart3 className="h-3 w-3" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-7 w-7">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold">TAM/SAM/SOM Settings</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="dealSize" className="text-[11px]">Average Deal Size ($)</Label>
                    <Input id="dealSize" type="number" value={tempDealSize} onChange={(e) => setTempDealSize(Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="conversion" className="text-[11px]">Conversion Rate (%)</Label>
                    <Input id="conversion" type="number" min="1" max="100" value={tempConversion} onChange={(e) => setTempConversion(Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsSettingsOpen(false)} className="flex-1 h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleSaveSettings} className="flex-1 h-7 text-xs">Apply</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {viewMode === "highlight" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 px-4 py-5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total Addressable Market</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight font-mono text-foreground">
                {formatCurrency(calculatedTAM)}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{tamAccounts.toLocaleString()} ICP-fit accounts</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/20" onClick={() => navigate("/accounts?fit=high")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">SAM</p>
                <p className="mt-1 text-xl font-semibold font-mono text-foreground tabular-nums">{formatCurrency(samValue)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{samPercentage.toFixed(0)}% of TAM</p>
              </button>
              <button type="button" className="rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/20" onClick={() => navigate("/accounts?fit=high&enriched=true")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">SOM</p>
                <p className="mt-1 text-xl font-semibold font-mono text-foreground tabular-nums">{formatCurrency(somValue)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{somPercentage.toFixed(0)}% of SAM</p>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {segments.map((segment) => (
                <button key={segment.label} type="button" className="rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/20" onClick={() => navigate("/accounts?fit=high")}>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{segment.label}</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight font-mono text-foreground tabular-nums">{formatCurrency(segment.value)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{segment.accounts.toLocaleString()} accts</p>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {segments.map((segment, index) => (
                <div key={segment.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{segment.sublabel}</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {index === 0 ? "100%" : `${segment.percentage.toFixed(0)}%`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${segment.percentage}%`, backgroundColor: segment.color }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 border-t pt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>
              {totalAccounts === 0
                ? "No accounts for market sizing yet."
                : samPercentage >= 50
                  ? "Strong ICP alignment — serviceable market is concentrated."
                  : samPercentage >= 25
                    ? "Moderate ICP concentration — opportunity to sharpen targeting."
                    : "Low ICP concentration — revisit qualification."}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
