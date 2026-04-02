import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings } from "lucide-react";

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

function fmt(value: number): string {
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
  averageDealSize: initDS = 75000,
  conversionRate: initCR = 0.15,
  className,
  onSettingsChange,
}: SimpleTAMCardProps) {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tmpDS, setTmpDS] = useState(initDS);
  const [tmpCR, setTmpCR] = useState(initCR * 100);

  useEffect(() => setTmpDS(initDS), [initDS]);
  useEffect(() => setTmpCR(initCR * 100), [initCR]);

  const save = () => {
    setIsSettingsOpen(false);
    onSettingsChange?.({ averageDealSize: tmpDS, conversionRate: tmpCR / 100 });
  };

  const tamAccts = highFitAccounts + medFitAccounts;
  const tam = tamValue && tamValue > 0 ? tamValue : tamAccts * initDS;
  const sam = highFitAccounts * initDS;
  const samPct = tamAccts > 0 ? (highFitAccounts / tamAccts) * 100 : 0;
  const som = campaignReadyAccounts * initDS * initCR;
  const somPct = highFitAccounts > 0 ? (campaignReadyAccounts / highFitAccounts) * 100 : 0;

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-4 px-5 pt-2">
        <div className="space-y-2">
          <p className="metric-panel__label">Total addressable market</p>
          <p className="font-heading text-[2.65rem] font-semibold tracking-[-0.07em] text-foreground tabular-nums">{fmt(tam)}</p>
          <p className="text-[14px] text-muted-foreground">{tamAccts.toLocaleString()} matching accounts</p>
        </div>

        <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-1 h-8 w-8 rounded-full p-0 text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Deal Size ($)</Label>
                <Input type="number" value={tmpDS} onChange={(e) => setTmpDS(Number(e.target.value))} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Conv. Rate (%)</Label>
                <Input type="number" min="1" max="100" value={tmpCR} onChange={(e) => setTmpCR(Number(e.target.value))} className="h-7 text-xs" />
              </div>
              <div className="flex gap-1.5 pt-1">
                <Button size="sm" variant="outline" onClick={() => setIsSettingsOpen(false)} className="h-6 flex-1 text-[11px]">Cancel</Button>
                <Button size="sm" onClick={save} className="h-6 flex-1 text-[11px]">Apply</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 gap-3 px-5 pb-5 pt-5 sm:grid-cols-2">
        <button type="button" className="metric-panel" onClick={() => navigate("/accounts?fit=high") }>
          <p className="metric-panel__label">Serviceable market</p>
          <p className="metric-panel__value">{fmt(sam)}</p>
          <p className="metric-panel__hint">{samPct.toFixed(0)}% of TAM</p>
        </button>
        <button type="button" className="metric-panel" onClick={() => navigate("/accounts?fit=high&enriched=true")}>
          <p className="metric-panel__label">Obtainable market</p>
          <p className="metric-panel__value">{fmt(som)}</p>
          <p className="metric-panel__hint">{somPct.toFixed(0)}% of SAM</p>
        </button>
      </div>
    </div>
  );
}
