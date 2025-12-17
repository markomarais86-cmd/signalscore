import { Search, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PRIMARY_INDUSTRIES, SUB_INDUSTRIES_MAP } from "@/constants/zoominfo-industries";

interface AccountsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sourceFilter: string | null;
  setSourceFilter: (value: string | null) => void;
  fitFilter: string | null;
  setFitFilter: (value: string | null) => void;
  industryFilter: string;
  setIndustryFilter: (value: string) => void;
  subIndustryFilter: string;
  setSubIndustryFilter: (value: string) => void;
  countryFilter: string | null;
  setCountryFilter: (value: string | null) => void;
  stateFilter: string | null;
  setStateFilter: (value: string | null) => void;
  campaignReadyFilter: boolean;
  setCampaignReadyFilter: (value: boolean) => void;
  uniqueCountries: string[];
  uniqueStates: string[];
  availableSubIndustries: string[];
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
}

export function AccountsFilters({
  searchTerm,
  setSearchTerm,
  sourceFilter,
  fitFilter,
  industryFilter,
  setIndustryFilter,
  subIndustryFilter,
  setSubIndustryFilter,
  countryFilter,
  stateFilter,
  campaignReadyFilter,
  setCampaignReadyFilter,
  uniqueCountries,
  uniqueStates,
  availableSubIndustries,
  searchParams,
  setSearchParams,
}: AccountsFiltersProps) {
  const handleSourceChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete('source');
    } else {
      params.set('source', value);
    }
    setSearchParams(params);
  };

  const handleFitChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete('fit');
    } else {
      params.set('fit', value);
    }
    setSearchParams(params);
  };

  const handleCountryChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete('country');
    } else {
      params.set('country', value);
    }
    setSearchParams(params);
  };

  const handleStateChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete('state');
    } else {
      params.set('state', value);
    }
    setSearchParams(params);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={sourceFilter || "all"} onValueChange={handleSourceChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
                <SelectItem value="database">Database</SelectItem>
              </SelectContent>
            </Select>

            <Select value={fitFilter || "all"} onValueChange={handleFitChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Fit Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fit Levels</SelectItem>
                <SelectItem value="high">High Fit</SelectItem>
                <SelectItem value="medium">Medium Fit</SelectItem>
                <SelectItem value="low">Low Fit</SelectItem>
              </SelectContent>
            </Select>

            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Primary Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Primary Industries</SelectItem>
                {PRIMARY_INDUSTRIES.map(industry => (
                  <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={subIndustryFilter} 
              onValueChange={setSubIndustryFilter}
              disabled={industryFilter === "all" || availableSubIndustries.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={industryFilter === "all" ? "Select Primary First" : "Sub-Industry"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub-Industries</SelectItem>
                {availableSubIndustries.map(subIndustry => (
                  <SelectItem key={subIndustry} value={subIndustry}>{subIndustry}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={countryFilter || "all"} onValueChange={handleCountryChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {uniqueCountries.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stateFilter || "all"} onValueChange={handleStateChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
              <Checkbox
                id="campaign-ready-filter"
                checked={campaignReadyFilter}
                onCheckedChange={(checked) => setCampaignReadyFilter(checked === true)}
              />
              <Label 
                htmlFor="campaign-ready-filter" 
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <Target className="h-4 w-4 text-primary" />
                Campaign Ready
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
