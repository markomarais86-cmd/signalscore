import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { DrilldownableCard } from "./DrilldownableCard";
import { ExecutiveMetricCard } from "./ExecutiveMetricCard";
import { ExportToPdf } from "./ExportToPdf";
import { ChevronLeft, Building2, MapPin, Users, Briefcase } from "lucide-react";

interface DrilldownLevel {
  id: string;
  name: string;
  level: "industry" | "subIndustry" | "country" | "persona";
  data: any[];
}

interface DrilldownNavigationProps {
  onExport: (format: 'pdf' | 'pptx' | 'csv') => void;
}

export function DrilldownNavigation({ onExport }: DrilldownNavigationProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<DrilldownLevel[]>([]);
  const [currentData, setCurrentData] = useState(getInitialIndustryData());

  const levelConfig = {
    industry: { 
      title: "Industry Analysis", 
      icon: Building2, 
      nextLevel: "subIndustry" as const,
      description: "Select an industry to analyze sub-sectors"
    },
    subIndustry: { 
      title: "Sub-Industry Breakdown", 
      icon: Briefcase, 
      nextLevel: "country" as const,
      description: "Drill down into geographic markets"
    },
    country: { 
      title: "Country Analysis", 
      icon: MapPin, 
      nextLevel: "persona" as const,
      description: "Explore persona-level intelligence"
    },
    persona: { 
      title: "Persona Intelligence", 
      icon: Users, 
      nextLevel: null,
      description: "Final level - persona analysis complete"
    }
  };

  function getInitialIndustryData() {
    return [
      {
        id: "manufacturing", 
        name: "Manufacturing", 
        value: 15400000000, 
        status: 82,
        trend: 12,
        subtitle: "3,240 accounts • $15.4B TAM"
      },
      {
        id: "technology", 
        name: "Technology & Software", 
        value: 8900000000, 
        status: 78,
        trend: 18,
        subtitle: "1,850 accounts • $8.9B TAM"
      },
      {
        id: "financial", 
        name: "Financial Services", 
        value: 6200000000, 
        status: 71,
        trend: 8,
        subtitle: "2,120 accounts • $6.2B TAM"
      },
      {
        id: "healthcare", 
        name: "Healthcare & Life Sciences", 
        value: 4700000000, 
        status: 85,
        trend: 22,
        subtitle: "1,340 accounts • $4.7B TAM"
      }
    ];
  }

  function getDrilldownData(parentId: string, level: "subIndustry" | "country" | "persona") {
    // Mock drill-down data - in real app, this would come from API
    const mockData: Record<string, Record<string, any[]>> = {
      manufacturing: {
        subIndustry: [
          { id: "pharmaceuticals", name: "Pharmaceuticals", value: 8750000000, status: 89, trend: 15, subtitle: "NAICS 325412 • 1,240 accounts" },
          { id: "aerospace", name: "Aerospace & Defense", value: 4200000000, status: 76, trend: 8, subtitle: "NAICS 336411 • 890 accounts" },
          { id: "automotive", name: "Automotive", value: 2450000000, status: 68, trend: -2, subtitle: "NAICS 336111 • 1,110 accounts" }
        ],
        country: [
          { id: "usa", name: "United States", value: 8200000000, status: 81, trend: 12, subtitle: "1,650 accounts • 65% market share" },
          { id: "germany", name: "Germany", value: 3100000000, status: 85, trend: 18, subtitle: "540 accounts • 20% market share" },
          { id: "japan", name: "Japan", value: 2100000000, status: 72, trend: 5, subtitle: "350 accounts • 15% market share" }
        ],
        persona: [
          { id: "cio", name: "Chief Information Officer", value: 4200000000, status: 92, trend: 22, subtitle: "180 accounts • 28% conv. rate" },
          { id: "cfo", name: "Chief Financial Officer", value: 2800000000, status: 78, trend: 12, subtitle: "145 accounts • 19% conv. rate" },
          { id: "vp-it", name: "VP of Information Technology", value: 1200000000, status: 85, trend: 18, subtitle: "95 accounts • 24% conv. rate" }
        ]
      },
      technology: {
        subIndustry: [
          { id: "saas", name: "Software as a Service", value: 5200000000, status: 84, trend: 25, subtitle: "950 accounts • High growth" },
          { id: "enterprise", name: "Enterprise Software", value: 2400000000, status: 79, trend: 12, subtitle: "420 accounts • Stable" },
          { id: "cloud", name: "Cloud Infrastructure", value: 1300000000, status: 88, trend: 35, subtitle: "480 accounts • Emerging" }
        ]
      }
    };

    return mockData[parentId]?.[level] || [];
  }

  const handleDrillDown = (itemId: string, item: any) => {
    const currentLevel = breadcrumbs.length === 0 ? "industry" : 
                        breadcrumbs[breadcrumbs.length - 1].level === "industry" ? "subIndustry" :
                        breadcrumbs[breadcrumbs.length - 1].level === "subIndustry" ? "country" : "persona";

    const nextLevel = levelConfig[currentLevel as keyof typeof levelConfig].nextLevel;
    if (!nextLevel) return; // Already at deepest level

    const newBreadcrumb: DrilldownLevel = {
      id: itemId,
      name: item.name,
      level: currentLevel,
      data: currentData
    };

    setBreadcrumbs([...breadcrumbs, newBreadcrumb]);
    
    // Get data for next level
    const nextData = getDrilldownData(itemId, nextLevel);
    setCurrentData(nextData);
  };

  const handleNavigateBack = (targetIndex: number = -1) => {
    if (targetIndex === -1) {
      // Go back one level
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      
      if (newBreadcrumbs.length === 0) {
        setCurrentData(getInitialIndustryData());
      } else {
        const parentLevel = newBreadcrumbs[newBreadcrumbs.length - 1];
        setCurrentData(parentLevel.data);
      }
    } else {
      // Navigate to specific breadcrumb level
      const newBreadcrumbs = breadcrumbs.slice(0, targetIndex + 1);
      setBreadcrumbs(newBreadcrumbs);
      
      if (targetIndex === -1) {
        setCurrentData(getInitialIndustryData());
      } else {
        const targetLevel = newBreadcrumbs[targetIndex];
        setCurrentData(targetLevel.data);
      }
    }
  };

  const getCurrentLevel = () => {
    if (breadcrumbs.length === 0) return "industry";
    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    const nextLevel = levelConfig[lastBreadcrumb.level].nextLevel;
    return nextLevel || "persona";
  };

  const currentLevel = getCurrentLevel();
  const config = levelConfig[currentLevel];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {breadcrumbs.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleNavigateBack()}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => {
                    setBreadcrumbs([]);
                    setCurrentData(getInitialIndustryData());
                  }}
                >
                  All Industries
                </BreadcrumbLink>
              </BreadcrumbItem>
              
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleNavigateBack(index)}
                    >
                      {crumb.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <ExportToPdf onExport={onExport} />
      </div>

      {/* Level Header */}
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">{config.title}</h2>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Current Level Data */}
      {currentData.length > 0 ? (
        <DrilldownableCard
          title={`${config.title} Performance`}
          data={currentData}
          onDrillDown={handleDrillDown}
          threshold={{ low: 40, medium: 65, high: 80 }}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No data available at this level</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Metrics for Current Level */}
      {currentData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ExecutiveMetricCard
            title="Total TAM"
            value={`$${(currentData.reduce((sum, item) => sum + item.value, 0) / 1000000000).toFixed(1)}B`}
            subtitle="addressable market"
            status={{
              value: Math.round(currentData.reduce((sum, item) => sum + item.status, 0) / currentData.length),
              threshold: { low: 40, medium: 65, high: 80 }
            }}
          />
          
          <ExecutiveMetricCard
            title="Segments"
            value={currentData.length}
            subtitle="analyzed"
            trend={{
              value: Math.round(currentData.reduce((sum, item) => sum + (item.trend || 0), 0) / currentData.length),
              period: "avg growth"
            }}
          />
          
          <ExecutiveMetricCard
            title="Top Performer"
            value={currentData.sort((a, b) => b.status - a.status)[0]?.name || "N/A"}
            subtitle={`${currentData.sort((a, b) => b.status - a.status)[0]?.status || 0}/100 score`}
            status={{
              value: currentData.sort((a, b) => b.status - a.status)[0]?.status || 0,
              threshold: { low: 40, medium: 65, high: 80 }
            }}
          />
        </div>
      )}
    </div>
  );
}