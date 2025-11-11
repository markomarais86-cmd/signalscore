import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, X, Building2, ChevronRight, Database, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
  geoTrends?: Record<string, number>;
  title?: string;
}

export function EnhancedGeographyCard({ geoData, invalidCount = 0, geoTrends = {}, title = "Geographic Heat Map" }: EnhancedGeographyCardProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [stateData, setStateData] = useState<StateData[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<string>("");
  const [tooltipContent, setTooltipContent] = useState({ country: "", count: 0 });
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<Array<{ country: string; crm: number; database: number }>>([]);
  
  const totalAccounts = geoData.reduce((sum, g) => sum + g.count, 0);
  const maxCount = geoData[0]?.count || 1;

  // Create a map for quick lookup
  const countryDataMap = new Map(geoData.map(d => [d.country.toLowerCase(), d]));

  // Color scale for heat map - from light to intense
  const colorScale = scaleLinear<string>()
    .domain([0, maxCount * 0.2, maxCount * 0.4, maxCount * 0.6, maxCount * 0.8, maxCount])
    .range([
      "hsl(var(--muted))",
      "hsl(210, 40%, 85%)",
      "hsl(210, 60%, 65%)",
      "hsl(220, 70%, 50%)",
      "hsl(230, 80%, 40%)",
      "hsl(240, 90%, 30%)"
    ]);

  useEffect(() => {
    if (selectedCountry && userProfile?.org_id) {
      loadStateData(selectedCountry);
    }
  }, [selectedCountry, userProfile?.org_id]);

  useEffect(() => {
    if (showComparison && userProfile?.org_id) {
      loadComparisonData();
    }
  }, [showComparison, userProfile?.org_id]);

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
        .slice(0, 25);

      setStateData(sortedStates);
    } catch (error) {
      console.error('Error loading state data:', error);
      setStateData([]);
    } finally {
      setLoadingStates(false);
    }
  };

  const handleCountryClick = (geoName: string, countryData: GeoData | undefined) => {
    if (countryData) {
      setSelectedCountry(countryData.country);
    }
  };

  const handleStateClick = (state: string) => {
    if (selectedCountry) {
      navigate(`/accounts?country=${encodeURIComponent(selectedCountry)}&state=${encodeURIComponent(state)}`);
    }
  };

  const handleViewAllAccounts = (country: string) => {
    navigate(`/accounts?country=${encodeURIComponent(country)}`);
  };

  // Country name mapping for better matching
  const normalizeCountryName = (name: string): string => {
    const mappings: Record<string, string> = {
      'united states of america': 'united states',
      'usa': 'united states',
      'uk': 'united kingdom',
      'czech republic': 'czechia',
    };
    const lower = name.toLowerCase();
    return mappings[lower] || lower;
  };

  const loadComparisonData = async () => {
    try {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('country, data_source')
        .eq('org_id', userProfile!.org_id)
        .not('country', 'is', null);
      
      if (error) throw error;

      // Group by country and source
      const comparison: Record<string, { country: string; crm: number; database: number }> = {};
      
      accounts?.forEach((a) => {
        if (!comparison[a.country]) {
          comparison[a.country] = { country: a.country, crm: 0, database: 0 };
        }
        if (a.data_source === 'crm' || a.data_source === 'both') {
          comparison[a.country].crm++;
        }
        if (a.data_source === 'database' || a.data_source === 'both') {
          comparison[a.country].database++;
        }
      });
      
      const sorted = Object.values(comparison)
        .sort((a, b) => (b.crm + b.database) - (a.crm + a.database))
        .slice(0, 10);
      
      setComparisonData(sorted);
    } catch (error) {
      console.error('Error loading comparison data:', error);
      setComparisonData([]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {title}
              <Badge variant="outline" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Your Database
              </Badge>
            </CardTitle>
            <CardDescription>
              {totalAccounts.toLocaleString()} accounts across {geoData.length} countries - Click to drill down
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Top: {geoData[0]?.country} ({geoData[0]?.count.toLocaleString()})
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showComparison ? 'Hide' : 'Show'} Source Comparison
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Interactive World Heat Map */}
        <div className="relative w-full bg-muted/10 rounded-lg overflow-hidden border" style={{ height: '500px' }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 130,
              center: [0, 20]
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup center={[0, 20]} zoom={1}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const geoName = geo.properties.name;
                    const normalizedGeoName = normalizeCountryName(geoName);
                    
                    // Try to find matching country data
                    let countryData = countryDataMap.get(normalizedGeoName);
                    
                    // Fallback: try partial matching
                    if (!countryData) {
                      for (const [key, value] of countryDataMap.entries()) {
                        if (key.includes(normalizedGeoName) || normalizedGeoName.includes(key)) {
                          countryData = value;
                          break;
                        }
                      }
                    }
                    
                    const count = countryData?.count || 0;
                    const isHovered = hoveredCountry === geoName;
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={count > 0 ? colorScale(count) : "hsl(var(--muted))"}
                        stroke="hsl(var(--border))"
                        strokeWidth={isHovered ? 1.5 : 0.5}
                        style={{
                          default: { 
                            outline: "none",
                            transition: "all 0.2s ease-in-out"
                          },
                          hover: { 
                            fill: count > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))", 
                            outline: "none",
                            cursor: count > 0 ? "pointer" : "default",
                            filter: "brightness(1.1)"
                          },
                          pressed: { 
                            outline: "none",
                            fill: "hsl(var(--primary))"
                          },
                        }}
                        onMouseEnter={() => {
                          setHoveredCountry(geoName);
                          if (count > 0) {
                            setTooltipContent({ 
                              country: countryData?.country || geoName, 
                              count 
                            });
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredCountry("");
                          setTooltipContent({ country: "", count: 0 });
                        }}
                        onClick={() => handleCountryClick(geoName, countryData)}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
          
          {/* Hover Tooltip */}
          {tooltipContent.country && (
            <div className="absolute top-4 left-4 bg-card border border-border rounded-lg px-4 py-2 shadow-lg z-10 pointer-events-none">
              <p className="font-semibold text-sm">{tooltipContent.country}</p>
              <p className="text-xs text-muted-foreground">
                {tooltipContent.count.toLocaleString()} accounts ({((tooltipContent.count / totalAccounts) * 100).toFixed(1)}%)
              </p>
              <p className="text-xs text-primary mt-1">Click to view regions</p>
            </div>
          )}
        </div>

        {/* Color Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Low</span>
          <div className="flex gap-1">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((val, i) => (
              <div
                key={i}
                className="w-8 h-3 rounded"
                style={{ backgroundColor: colorScale(maxCount * val) }}
              />
            ))}
          </div>
          <span>High ({maxCount.toLocaleString()})</span>
        </div>

        {/* Top Countries Summary with Trends */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          {geoData.slice(0, 4).map((geo, idx) => {
            const trend = geoTrends[geo.country];
            const isPositive = (trend || 0) >= 0;
            
            return (
              <div 
                key={geo.country}
                className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedCountry(geo.country)}
              >
                <div className="text-xl font-bold text-primary">
                  {geo.count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {geo.country}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs font-medium mt-1">
                  <span>{((geo.count / totalAccounts) * 100).toFixed(1)}%</span>
                  {trend !== undefined && trend !== 0 && (
                    <span className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '↑' : '↓'}{Math.abs(trend)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Source Comparison Chart */}
        {showComparison && comparisonData.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold mb-4">CRM vs Database Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="country" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <RechartsTooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="crm" fill="hsl(var(--primary))" name="CRM" />
                <Bar dataKey="database" fill="hsl(var(--chart-2))" name="Database" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>

      {/* State/Region Drill-down Sheet */}
      <Sheet open={!!selectedCountry} onOpenChange={(open) => !open && setSelectedCountry(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {selectedCountry}
            </SheetTitle>
            <SheetDescription>
              State and region breakdown
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => selectedCountry && handleViewAllAccounts(selectedCountry)}
            >
              <Building2 className="h-4 w-4 mr-2" />
              View All {selectedCountry} Accounts
            </Button>

            {loadingStates ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : stateData.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">States / Regions</h4>
                  <Badge variant="secondary" className="text-xs">
                    {stateData.length} found
                  </Badge>
                </div>
                {stateData.map((state, idx) => {
                  const maxStateCount = stateData[0]?.count || 1;
                  return (
                    <div
                      key={state.state}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group"
                      onClick={() => handleStateClick(state.state)}
                    >
                      <Badge 
                        variant={idx < 3 ? "default" : "outline"}
                        className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 font-bold text-xs"
                      >
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-sm font-medium truncate">{state.state}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold">
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
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No state/region data available</p>
                <p className="text-xs mt-1">Try viewing all accounts instead</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
