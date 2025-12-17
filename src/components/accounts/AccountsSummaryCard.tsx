import { X, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/utils/format-numbers";

interface UnfilteredTotals {
  total: number;
  crm: number;
  database: number;
  highFit: number;
  withLeads: number;
  avgQuality: number;
}

interface AccountsSummaryCardProps {
  unfilteredTotals: UnfilteredTotals;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  // Active filter values for badges
  sourceFilter: string | null;
  fitFilter: string | null;
  countryFilter: string | null;
  stateFilter: string | null;
  icpFilter: string | null;
  searchTerm: string;
  industryFilter: string;
  subIndustryFilter: string;
  campaignReadyFilter: boolean;
  // Filter removal handlers
  setSearchTerm: (value: string) => void;
  setIndustryFilter: (value: string) => void;
  setSubIndustryFilter: (value: string) => void;
  setCampaignReadyFilter: (value: boolean) => void;
  removeFilter: (filterType: string) => void;
}

export function AccountsSummaryCard({
  unfilteredTotals,
  hasActiveFilters,
  clearFilters,
  sourceFilter,
  fitFilter,
  countryFilter,
  stateFilter,
  icpFilter,
  searchTerm,
  industryFilter,
  subIndustryFilter,
  campaignReadyFilter,
  setSearchTerm,
  setIndustryFilter,
  setSubIndustryFilter,
  setCampaignReadyFilter,
  removeFilter,
}: AccountsSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Accounts Overview</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear All Filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold">{formatNumber(unfilteredTotals.total)}</div>
          <div className="text-sm text-muted-foreground">Total Accounts</div>
        </div>
        
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {formatNumber(unfilteredTotals.crm)} CRM
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {formatNumber(unfilteredTotals.database)} Database
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <div className="text-sm font-medium">{formatNumber(unfilteredTotals.highFit)}</div>
            <div className="text-xs text-muted-foreground">
              High-Fit ({unfilteredTotals.total > 0 ? Math.round((unfilteredTotals.highFit / unfilteredTotals.total) * 100) : 0}%)
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">{formatNumber(unfilteredTotals.withLeads)}</div>
            <div className="text-xs text-muted-foreground">With Leads</div>
          </div>
          <div>
            <div className="text-sm font-medium">{unfilteredTotals.avgQuality}%</div>
            <div className="text-xs text-muted-foreground">Avg Completeness</div>
          </div>
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Active Filters:</div>
            <div className="flex flex-wrap gap-2">
              {sourceFilter && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  Source: {sourceFilter}
                  <X className="h-3 w-3" onClick={() => removeFilter('source')} />
                </Badge>
              )}
              {fitFilter && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  Fit: {fitFilter}
                  <X className="h-3 w-3" onClick={() => removeFilter('fit')} />
                </Badge>
              )}
              {countryFilter && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  Country: {countryFilter}
                  <X className="h-3 w-3" onClick={() => removeFilter('country')} />
                </Badge>
              )}
              {stateFilter && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  State: {stateFilter}
                  <X className="h-3 w-3" onClick={() => removeFilter('state')} />
                </Badge>
              )}
              {icpFilter && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  ICP Filter Active
                  <X className="h-3 w-3" onClick={() => removeFilter('icp_id')} />
                </Badge>
              )}
              {searchTerm && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  Search: "{searchTerm}"
                  <X className="h-3 w-3" onClick={() => setSearchTerm("")} />
                </Badge>
              )}
              {industryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  Primary Industry: {industryFilter}
                  <X className="h-3 w-3" onClick={() => setIndustryFilter("all")} />
                </Badge>
              )}
              {subIndustryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                  Sub-Industry: {subIndustryFilter}
                  <X className="h-3 w-3" onClick={() => setSubIndustryFilter("all")} />
                </Badge>
              )}
              {campaignReadyFilter && (
                <Badge 
                  className="gap-1 cursor-pointer bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                >
                  <Target className="h-3 w-3" />
                  Campaign Ready
                  <X className="h-3 w-3" onClick={() => setCampaignReadyFilter(false)} />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
