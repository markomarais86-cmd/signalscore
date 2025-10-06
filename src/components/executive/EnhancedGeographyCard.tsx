import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, ChevronDown, ArrowLeft, Building2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface GeoData {
  country: string;
  count: number;
}

interface StateData {
  state: string;
  count: number;
}

interface EnhancedGeographyCardProps {
  geoData: GeoData[];
  invalidCount?: number;
}

export function EnhancedGeographyCard({ geoData, invalidCount = 0 }: EnhancedGeographyCardProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [stateData, setStateData] = useState<StateData[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  
  const totalAccounts = geoData.reduce((sum, g) => sum + g.count, 0);
  const maxCount = geoData[0]?.count || 1;

  useEffect(() => {
    if (expandedCountry && userProfile?.org_id) {
      loadStateData(expandedCountry);
    }
  }, [expandedCountry, userProfile?.org_id]);

  const loadStateData = async (country: string) => {
    setLoadingStates(true);
    try {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('state_province')
        .eq('org_id', userProfile!.org_id)
        .eq('country', country)
        .not('state_province', 'is', null);

      if (error) throw error;

      const stateCounts = accounts.reduce((acc, a) => {
        const state = a.state_province || 'Unknown';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sortedStates = Object.entries(stateCounts)
        .map(([state, count]) => ({ state, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setStateData(sortedStates);
    } catch (error) {
      console.error('Error loading state data:', error);
      setStateData([]);
    } finally {
      setLoadingStates(false);
    }
  };

  const handleCountryClick = (country: string) => {
    if (expandedCountry === country) {
      setExpandedCountry(null);
    } else {
      setExpandedCountry(country);
    }
  };

  const handleStateClick = (country: string, state: string) => {
    navigate(`/accounts?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`);
  };

  const handleViewAllAccounts = (country: string) => {
    navigate(`/accounts?country=${encodeURIComponent(country)}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Geographic Distribution
            </CardTitle>
            <CardDescription>
              {totalAccounts.toLocaleString()} accounts across {geoData.length} countries
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            Click to drill down ↓
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {geoData.slice(0, 15).map((geo, idx) => {
          const isExpanded = expandedCountry === geo.country;
          const maxStateCount = stateData[0]?.count || 1;
          
          return (
            <div key={geo.country} className="space-y-2">
              {/* Country Row */}
              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
                  "hover:bg-accent hover:shadow-sm",
                  isExpanded && "bg-accent shadow-sm"
                )}
                onClick={() => handleCountryClick(geo.country)}
              >
                <Badge 
                  variant={idx < 3 ? "default" : "outline"}
                  className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 font-bold"
                >
                  {idx + 1}
                </Badge>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">{geo.country}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold">
                        {geo.count.toLocaleString()}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round((geo.count / totalAccounts) * 100)}%
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAllAccounts(geo.country);
                        }}
                      >
                        <Building2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Progress 
                    value={(geo.count / maxCount) * 100} 
                    className="h-2"
                  />
                </div>
              </div>

              {/* Expanded State/Region Breakdown */}
              {isExpanded && (
                <div className="ml-14 mr-2 space-y-2 animate-in slide-in-from-top-2">
                  {loadingStates ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : stateData.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <div className="h-px flex-1 bg-border" />
                        <span>States/Regions</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      {stateData.map((state, stateIdx) => (
                        <div
                          key={state.state}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => handleStateClick(geo.country, state.state)}
                        >
                          <Badge 
                            variant="outline"
                            className="w-6 h-6 flex items-center justify-center rounded text-xs shrink-0"
                          >
                            {stateIdx + 1}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium truncate">{state.state}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted-foreground">
                                  {state.count.toLocaleString()}
                                </span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                            <Progress 
                              value={(state.count / maxStateCount) * 100} 
                              className="h-1.5"
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No state/region data available
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {geoData.length > 15 && (
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => navigate('/accounts')}
          >
            View All {geoData.length} Countries
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
