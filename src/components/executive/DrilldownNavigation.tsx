import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { DrilldownableCard } from "./DrilldownableCard";
import { ExecutiveMetricCard } from "./ExecutiveMetricCard";
import { ExportToPdf } from "./ExportToPdf";
import { ChevronLeft, Building2, MapPin, Users, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DrilldownLevel {
  id: string;
  name: string;
  level: "industry" | "country" | "persona";
  data: any[];
}

interface DrilldownNavigationProps {
  onExport: (format: 'pdf' | 'pptx' | 'csv') => void;
}

interface DrilldownContext {
  industry?: string;
  country?: string;
}

export function DrilldownNavigation({ onExport }: DrilldownNavigationProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<DrilldownLevel[]>([]);
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<DrilldownContext>({});
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const levelConfig = {
    industry: { 
      title: "Industry Analysis", 
      icon: Building2, 
      nextLevel: "country" as const,
      description: "Select an industry to analyze by geography"
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

  async function loadIndustryData() {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_industry_drilldown' as any, {
        p_org_id: userProfile.org_id
      });

      if (rpcError) throw rpcError;

      // Transform to match expected format
      const transformed = Array.isArray(data) ? data.map((row: any) => ({
        id: row.id,
        name: row.name,
        value: 0, // We don't have TAM in this query
        status: row.avg_score || 0,
        trend: 0, // No trend data yet
        subtitle: `${row.account_count} accounts • ${row.lead_count} leads • ${row.campaign_ready_count} campaign-ready`
      })) : [];

      setCurrentData(transformed);
    } catch (err: any) {
      console.error('Error loading industry data:', err);
      setError(err.message || 'Failed to load industry data');
      toast({
        title: "Error",
        description: "Failed to load industry data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDrilldownData(level: "country" | "persona", ctx: DrilldownContext) {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    setError(null);

    try {
      let data, rpcError;

      if (level === "country") {
        // Load countries for selected industry
        const result = await supabase.rpc('get_country_drilldown' as any, {
          p_org_id: userProfile.org_id,
          p_industry: ctx.industry || 'all'
        });
        data = result.data;
        rpcError = result.error;
      } else if (level === "persona") {
        // Load personas for selected industry + country
        const result = await supabase.rpc('get_persona_drilldown' as any, {
          p_org_id: userProfile.org_id,
          p_industry: ctx.industry || 'all',
          p_country: ctx.country || 'all'
        });
        data = result.data;
        rpcError = result.error;
      }

      if (rpcError) throw rpcError;

      // Transform to match expected format
      const transformed = Array.isArray(data) ? data.map((row: any) => {
        if (level === "country") {
          return {
            id: row.id,
            name: row.name,
            value: 0,
            status: row.avg_score || 0,
            trend: 0,
            subtitle: `${row.account_count} accounts • ${row.lead_count} leads • ${row.market_share}% market share`
          };
        } else {
          return {
            id: row.id,
            name: row.name,
            value: 0,
            status: row.avg_score || 0,
            trend: 0,
            subtitle: `${row.lead_count} leads • ${row.account_count} accounts • ${row.coverage_rate}% coverage`
          };
        }
      }) : [];

      setCurrentData(transformed);
    } catch (err: any) {
      console.error(`Error loading ${level} data:`, err);
      setError(err.message || `Failed to load ${level} data`);
      toast({
        title: "Error",
        description: `Failed to load ${level} data`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDrillDown = async (itemId: string, item: any) => {
    const currentLevel = breadcrumbs.length === 0 ? "industry" : 
                        breadcrumbs[breadcrumbs.length - 1].level === "industry" ? "country" : "persona";

    const nextLevel = levelConfig[currentLevel as keyof typeof levelConfig].nextLevel;
    if (!nextLevel) return; // Already at deepest level

    const newBreadcrumb: DrilldownLevel = {
      id: itemId,
      name: item.name,
      level: currentLevel,
      data: currentData
    };

    setBreadcrumbs([...breadcrumbs, newBreadcrumb]);
    
    // Update context
    const newContext = { ...context };
    if (currentLevel === "industry") {
      newContext.industry = itemId;
    } else if (currentLevel === "country") {
      newContext.country = itemId;
    }
    setContext(newContext);
    
    // Load data for next level
    await loadDrilldownData(nextLevel, newContext);
  };

  const handleNavigateBack = async (targetIndex: number = -1) => {
    if (targetIndex === -1) {
      // Go back one level
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      
      if (newBreadcrumbs.length === 0) {
        setContext({});
        await loadIndustryData();
      } else {
        const parentLevel = newBreadcrumbs[newBreadcrumbs.length - 1];
        setCurrentData(parentLevel.data);
        
        // Rebuild context
        const newContext: DrilldownContext = {};
        newBreadcrumbs.forEach((crumb) => {
          if (crumb.level === "industry") newContext.industry = crumb.id;
          if (crumb.level === "country") newContext.country = crumb.id;
        });
        setContext(newContext);
      }
    } else {
      // Navigate to specific breadcrumb level
      const newBreadcrumbs = breadcrumbs.slice(0, targetIndex + 1);
      setBreadcrumbs(newBreadcrumbs);
      
      if (targetIndex === -1) {
        setContext({});
        await loadIndustryData();
      } else {
        const targetLevel = newBreadcrumbs[targetIndex];
        setCurrentData(targetLevel.data);
        
        // Rebuild context
        const newContext: DrilldownContext = {};
        newBreadcrumbs.forEach((crumb) => {
          if (crumb.level === "industry") newContext.industry = crumb.id;
          if (crumb.level === "country") newContext.country = crumb.id;
        });
        setContext(newContext);
      }
    }
  };

  const getCurrentLevel = () => {
    if (breadcrumbs.length === 0) return "industry";
    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    const nextLevel = levelConfig[lastBreadcrumb.level].nextLevel;
    return nextLevel || "persona";
  };

  // Load initial data on mount
  useEffect(() => {
    if (userProfile?.org_id) {
      loadIndustryData();
    }
  }, [userProfile?.org_id]);

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
              disabled={isLoading}
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
                  onClick={async () => {
                    setBreadcrumbs([]);
                    setContext({});
                    await loadIndustryData();
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

        <ExportToPdf />
      </div>

      {/* Level Header */}
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">{config.title}</h2>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="link" 
              className="ml-2 h-auto p-0"
              onClick={() => {
                if (breadcrumbs.length === 0) {
                  loadIndustryData();
                } else {
                  const lastLevel = breadcrumbs[breadcrumbs.length - 1].level;
                  const nextLevel = levelConfig[lastLevel].nextLevel;
                  if (nextLevel) {
                    loadDrilldownData(nextLevel, context);
                  }
                }
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading {config.title.toLowerCase()}...</p>
          </CardContent>
        </Card>
      )}

      {/* Current Level Data */}
      {!isLoading && !error && (
        <>
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
                <p className="text-muted-foreground">
                  {breadcrumbs.length === 0 
                    ? "No accounts found. Please upload your data to get started."
                    : `No data available for ${config.title.toLowerCase()}`
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary Metrics for Current Level */}
          {currentData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ExecutiveMetricCard
                title="Average Score"
                value={Math.round(currentData.reduce((sum, item) => sum + item.status, 0) / currentData.length)}
                subtitle="ICP fit score"
                status={{
                  value: Math.round(currentData.reduce((sum, item) => sum + item.status, 0) / currentData.length),
                  threshold: { low: 40, medium: 65, high: 80 }
                }}
              />
              
              <ExecutiveMetricCard
                title="Segments"
                value={currentData.length}
                subtitle="analyzed"
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
        </>
      )}
    </div>
  );
}
