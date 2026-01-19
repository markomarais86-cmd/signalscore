import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EnrichedLeadsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  enrichmentSource: string;
  onEnrichmentSourceChange: (value: string) => void;
  confidenceLevel: 'high' | 'medium' | 'low' | 'all';
  onConfidenceLevelChange: (value: 'high' | 'medium' | 'low' | 'all') => void;
  dateRange: 'day' | 'week' | 'month' | 'all';
  onDateRangeChange: (value: 'day' | 'week' | 'month' | 'all') => void;
  hasPhone: boolean | null;
  onHasPhoneChange: (value: boolean | null) => void;
  icpQualified: boolean | null;
  onIcpQualifiedChange: (value: boolean | null) => void;
  onClearFilters: () => void;
}

export function EnrichedLeadsFilters({
  searchTerm,
  onSearchChange,
  enrichmentSource,
  onEnrichmentSourceChange,
  confidenceLevel,
  onConfidenceLevelChange,
  dateRange,
  onDateRangeChange,
  hasPhone,
  onHasPhoneChange,
  icpQualified,
  onIcpQualifiedChange,
  onClearFilters
}: EnrichedLeadsFiltersProps) {
  const hasActiveFilters = 
    searchTerm || 
    enrichmentSource !== 'all' || 
    confidenceLevel !== 'all' || 
    dateRange !== 'all' || 
    hasPhone !== null || 
    icpQualified !== null;

  const activeFilterCount = [
    searchTerm,
    enrichmentSource !== 'all' ? enrichmentSource : null,
    confidenceLevel !== 'all' ? confidenceLevel : null,
    dateRange !== 'all' ? dateRange : null,
    hasPhone !== null ? 'phone' : null,
    icpQualified !== null ? 'icp' : null
  ].filter(Boolean).length;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, company..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Enrichment Source */}
          <Select value={enrichmentSource} onValueChange={onEnrichmentSourceChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="perplexity">Perplexity</SelectItem>
              <SelectItem value="apollo">Apollo</SelectItem>
              <SelectItem value="firecrawl">Firecrawl</SelectItem>
              <SelectItem value="pdl">PDL</SelectItem>
            </SelectContent>
          </Select>

          {/* Confidence Level */}
          <Select value={confidenceLevel} onValueChange={(v) => onConfidenceLevelChange(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="high">High (80%+)</SelectItem>
              <SelectItem value="medium">Medium (50-79%)</SelectItem>
              <SelectItem value="low">Low (&lt;50%)</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range */}
          <Select value={dateRange} onValueChange={(v) => onDateRangeChange(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="day">Last 24h</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          {/* Has Phone */}
          <Select 
            value={hasPhone === null ? 'all' : hasPhone ? 'yes' : 'no'} 
            onValueChange={(v) => onHasPhoneChange(v === 'all' ? null : v === 'yes')}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Has Phone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Has Phone</SelectItem>
              <SelectItem value="no">No Phone</SelectItem>
            </SelectContent>
          </Select>

          {/* ICP Qualified */}
          <Select 
            value={icpQualified === null ? 'all' : icpQualified ? 'yes' : 'no'} 
            onValueChange={(v) => onIcpQualifiedChange(v === 'all' ? null : v === 'yes')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="ICP Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">ICP Qualified</SelectItem>
              <SelectItem value="no">Not Qualified</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFilterCount}
              </Badge>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
