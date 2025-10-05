import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GeoData {
  country: string;
  count: number;
  states?: Array<{ state: string; count: number }>;
}

interface EnhancedGeographyCardProps {
  geoData: GeoData[];
  onDrillDown?: (country: string) => void;
}

export function EnhancedGeographyCard({ geoData, onDrillDown }: EnhancedGeographyCardProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const maxCount = geoData[0]?.count || 1;

  const topCountries = geoData.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Top Geographies
        </CardTitle>
        <CardDescription>
          Account distribution by location - {topCountries.length} countries
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                onClick={() => {
                  setSelectedCountry(geo.country);
                  onDrillDown?.(geo.country);
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
                        ({Math.round((geo.count / geoData.reduce((sum, g) => sum + g.count, 0)) * 100)}%)
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
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  State-level data for {selectedCountry}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This feature requires additional data enrichment
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
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  Select a country to view state/region breakdown
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
