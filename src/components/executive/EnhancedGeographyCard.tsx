import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, ChevronRight, Map, BarChart3, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { normalizeCountryData } from "@/utils/country-normalizer";
import { 
  ComposableMap, 
  Geographies, 
  Geography,
  ZoomableGroup 
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeoData {
  country: string;
  count: number;
  states?: Array<{ state: string; count: number }>;
}

interface EnhancedGeographyCardProps {
  geoData: GeoData[];
  onDrillDown?: (country: string) => void;
  invalidCount?: number;
}

export function EnhancedGeographyCard({ geoData, onDrillDown, invalidCount = 0 }: EnhancedGeographyCardProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [stateData, setStateData] = useState<Array<{ state: string; count: number }>>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [dataView, setDataView] = useState<'accounts' | 'leads'>('accounts');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [tooltipContent, setTooltipContent] = useState("");
  
  const totalAccounts = geoData.reduce((sum, g) => sum + g.count, 0);
  const maxCount = geoData[0]?.count || 1;
  const topCountries = geoData.slice(0, 20);
  
  // Calculate data quality
  const dataQualityScore = totalAccounts > 0 
    ? Math.round(((totalAccounts - invalidCount) / (totalAccounts + invalidCount)) * 100)
    : 100;
  
  // Color scale for heat map
  const colorScale = scaleLinear<string>()
    .domain([0, maxCount * 0.25, maxCount * 0.5, maxCount * 0.75, maxCount])
    .range([
      "hsl(var(--muted))",
      "hsl(var(--chart-3))",
      "hsl(var(--signal-medium))",
      "hsl(var(--primary))",
      "hsl(var(--signal-high))"
    ]);

  useEffect(() => {
    if (selectedCountry && userProfile?.org_id) {
      loadStateData(selectedCountry);
    }
  }, [selectedCountry, userProfile?.org_id]);

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
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setStateData(sortedStates);
    } catch (error) {
      console.error('Error loading state data:', error);
    } finally {
      setLoadingStates(false);
    }
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
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                className="h-7 px-2"
                onClick={() => setViewMode('list')}
              >
                <BarChart3 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                className="h-7 px-2"
                onClick={() => setViewMode('map')}
              >
                <Map className="h-3 w-3" />
              </Button>
            </div>
            {/* Data Source Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                size="sm"
                variant={dataView === 'accounts' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setDataView('accounts')}
              >
                Accounts
              </Button>
              <Button
                size="sm"
                variant={dataView === 'leads' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setDataView('leads')}
              >
                Leads
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Data Quality Warning */}
        {dataQualityScore < 95 && invalidCount > 0 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                {invalidCount} accounts have invalid geography data
              </span>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={() => navigate('/settings')}
              >
                Review issues
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {viewMode === 'map' ? (
          /* Heat Map View */
          <div className="space-y-4">
            <div className="w-full h-[400px] bg-muted/20 rounded-lg overflow-hidden border">
              <TooltipProvider>
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 100,
                  }}
                >
                  <ZoomableGroup center={[0, 20]} zoom={1}>
                    <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const countryName = geo.properties.name;
                          const countryData = geoData.find(
                            d => d.country.toLowerCase() === countryName.toLowerCase() ||
                                 d.country === countryName
                          );
                          const count = countryData?.count || 0;
                          
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={count > 0 ? colorScale(count) : "hsl(var(--muted))"}
                              stroke="hsl(var(--border))"
                              strokeWidth={0.5}
                              style={{
                                default: { outline: "none" },
                                hover: { 
                                  fill: "hsl(var(--primary))", 
                                  outline: "none",
                                  cursor: count > 0 ? "pointer" : "default"
                                },
                                pressed: { outline: "none" },
                              }}
                              onMouseEnter={() => {
                                if (count > 0) {
                                  setTooltipContent(`${countryName}: ${count.toLocaleString()} accounts`);
                                }
                              }}
                              onMouseLeave={() => {
                                setTooltipContent("");
                              }}
                              onClick={() => {
                                if (count > 0 && countryData) {
                                  setSelectedCountry(countryData.country);
                                  onDrillDown?.(countryData.country);
                                }
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
              </TooltipProvider>
              {tooltipContent && (
                <div className="absolute top-4 left-4 bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
                  {tooltipContent}
                </div>
              )}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span>Low</span>
              <div className="flex gap-1">
                {[0, 0.25, 0.5, 0.75, 1].map((val, i) => (
                  <div
                    key={i}
                    className="w-8 h-3 rounded"
                    style={{ backgroundColor: colorScale(maxCount * val) }}
                  />
                ))}
              </div>
              <span>High ({maxCount.toLocaleString()})</span>
            </div>
          </div>
        ) : (
          /* List View */
          <Tabs defaultValue="countries" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="countries">Countries</TabsTrigger>
              <TabsTrigger value="states" disabled={!selectedCountry}>
                States/Regions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="countries" className="space-y-3 mt-4">
              {topCountries.map((geo, idx) => (
                <div 
                  key={geo.country} 
                  className="flex items-center gap-3 group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      navigate(`/accounts?country=${encodeURIComponent(geo.country)}`);
                    } else {
                      setSelectedCountry(geo.country);
                      onDrillDown?.(geo.country);
                    }
                  }}
                >
                  <Badge 
                    variant="outline" 
                    className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
                  >
                    {idx + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate">{geo.country}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-muted-foreground">
                          {geo.count.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({Math.round((geo.count / totalAccounts) * 100)}%)
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <Progress 
                      value={(geo.count / maxCount) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="states" className="mt-4">
            {selectedCountry ? (
              loadingStates ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : stateData.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-sm">
                      {selectedCountry} - States/Regions
                    </h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedCountry(null)}
                    >
                      Back to Countries
                    </Button>
                  </div>
                  {stateData.map((state, idx) => {
                    const maxStateCount = stateData[0]?.count || 1;
                    return (
                      <div 
                        key={state.state} 
                        className="flex items-center gap-3 group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                        onClick={() => navigate(`/accounts?country=${encodeURIComponent(selectedCountry)}&state=${encodeURIComponent(state.state)}`)}
                      >
                        <Badge 
                          variant="outline" 
                          className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
                        >
                          {idx + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium truncate">{state.state}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm text-muted-foreground">
                                {state.count.toLocaleString()}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <Progress 
                            value={(state.count / maxStateCount) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">
                    No state/region data available for {selectedCountry}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => setSelectedCountry(null)}
                  >
                    Back to Countries
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  Select a country to view state/region breakdown
                </p>
              </div>
            )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
