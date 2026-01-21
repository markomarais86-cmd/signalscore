import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { FilterCriteria } from "../hooks/useCampaignState";
import { EMPLOYEE_RANGES, REVENUE_RANGES, MARKET_SEGMENTS, MANAGEMENT_LEVELS } from "../constants/campaign-config";
import { formatNumber } from "@/utils/format-numbers";

interface TargetingStepProps {
  useICP: boolean;
  filterCriteria: FilterCriteria;
  setFilterCriteria: (update: Partial<FilterCriteria> | ((prev: FilterCriteria) => FilterCriteria)) => void;
  realtimeLeadCount: number | null;
  isCountingLeads: boolean;
  estimatedCost: number;
  dataSource: 'all' | 'crm' | 'database';
  provider: string;
}

export function TargetingStep({
  useICP,
  filterCriteria,
  setFilterCriteria,
  realtimeLeadCount,
  isCountingLeads,
  estimatedCost,
  dataSource,
  provider
}: TargetingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Targeting Filters</h3>
        <p className="text-sm text-muted-foreground">
          Define who you want to target by company size, revenue, market segment, and management level
        </p>
      </div>
      
      {/* Real-time preview */}
      <Card className="bg-gradient-to-r from-primary/5 to-muted border-primary/20">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Available Leads</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {isCountingLeads ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  formatNumber(realtimeLeadCount || 0)
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Estimated Cost</div>
              <div className="text-2xl font-bold">${estimatedCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Data Source</div>
              <div className="text-lg font-semibold">
                {dataSource === 'all' ? 'All Sources' : dataSource === 'crm' ? 'CRM (Free)' : provider}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!useICP && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Employee Count</Label>
            <Select
              onValueChange={(value) => {
                const range = EMPLOYEE_RANGES.find(r => r.label === value);
                setFilterCriteria({
                  employeeMin: range?.min,
                  employeeMax: range?.max ?? undefined
                });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
              <SelectContent>
                {EMPLOYEE_RANGES.map(range => (
                  <SelectItem key={range.label} value={range.label}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Revenue Range</Label>
            <Select
              onValueChange={(value) => {
                const range = REVENUE_RANGES.find(r => r.label === value);
                setFilterCriteria({
                  revenueMin: range?.min,
                  revenueMax: range?.max ?? undefined
                });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
              <SelectContent>
                {REVENUE_RANGES.map(range => (
                  <SelectItem key={range.label} value={range.label}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        <Label className="mb-3 block">
          Market Segment (Select all that apply)
          <span className="text-xs text-muted-foreground block mt-1">
            These segments combine employee count and revenue filters
          </span>
        </Label>
        <div className="space-y-2">
          {MARKET_SEGMENTS.map(segment => (
            <div key={segment.value} className="flex items-center space-x-2">
              <Checkbox
                id={segment.value}
                checked={filterCriteria.marketSegments.includes(segment.value)}
                onCheckedChange={(checked) => {
                  setFilterCriteria(prev => ({
                    ...prev,
                    marketSegments: checked
                      ? [...prev.marketSegments, segment.value]
                      : prev.marketSegments.filter(s => s !== segment.value)
                  }));
                }}
              />
              <Label htmlFor={segment.value} className="cursor-pointer">{segment.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">
          Fit Score Range: <span className="font-semibold text-primary">{filterCriteria.fitScoreMin} - {filterCriteria.fitScoreMax}</span>
        </Label>
        <Slider
          value={[filterCriteria.fitScoreMin, filterCriteria.fitScoreMax]}
          onValueChange={(value) => setFilterCriteria({
            fitScoreMin: value[0],
            fitScoreMax: value[1]
          })}
          min={0}
          max={100}
          step={5}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Filter accounts by their fit score range (0-100)
        </p>
      </div>

      <div>
        <Label className="mb-3 block">Management Levels</Label>
        <div className="space-y-2">
          {MANAGEMENT_LEVELS.map(level => (
            <div key={level} className="flex items-center space-x-2">
              <Checkbox
                id={level}
                checked={filterCriteria.managementLevels.includes(level)}
                onCheckedChange={(checked) => {
                  setFilterCriteria(prev => ({
                    ...prev,
                    managementLevels: checked
                      ? [...prev.managementLevels, level]
                      : prev.managementLevels.filter(l => l !== level)
                  }));
                }}
              />
              <Label htmlFor={level}>{level}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
