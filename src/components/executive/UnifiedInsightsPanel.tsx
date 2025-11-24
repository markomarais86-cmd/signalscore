import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Zap, 
  Target, 
  TrendingUp, 
  X, 
  RefreshCw,
  Sparkles,
  Download,
  Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { EnrichmentModal } from "./EnrichmentModal";

import { detectRisks, RiskItem, RiskSeverity } from "@/utils/risk-detector";

export interface Insight {
  id?: string;
  type: string;
  category?: 'revenue' | 'firmographic' | 'signal' | 'efficiency' | 'quality' | 'growth' | 'persona';
  title: string;
  description: string;
  impact: string;
  why?: string;
  action?: string;
  route?: string;
  filter?: Record<string, any>;
  priority?: number | 'high' | 'medium' | 'low';
  confidence?: number;
  relatedSegments?: string[];
  relatedRisk?: string; // Links AI insight to specific risk
}

interface UnifiedInsightsPanelProps {
  risks: RiskItem[];
  insights: Insight[];
  onRefresh?: () => void;
  campaignReadyCount?: number;
  completenessScore?: number;
  totalScored?: number;
}

type UnifiedItem = {
  id: string;
  type: 'risk' | 'insight';
  priority: number; // 1-10, higher = more urgent
  severity?: RiskSeverity;
  category?: string;
  title: string;
  description: string;
  impact: string;
  count?: number;
  action?: string;
  route?: string;
  filter?: Record<string, any>;
  relatedRisk?: string;
  source: RiskItem | Insight;
};

export function UnifiedInsightsPanel({
  risks,
  insights,
  onRefresh,
  campaignReadyCount = 0,
  completenessScore = 0,
  totalScored = 0
}: UnifiedInsightsPanelProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false);
  const [selectedEnrichmentFields, setSelectedEnrichmentFields] = useState<string[]>([]);

  // Merge and prioritize all items
  const unifiedItems: UnifiedItem[] = [
    // Convert risks to unified format
    ...risks.map(risk => ({
      id: risk.id,
      type: 'risk' as const,
      priority: risk.severity === 'critical' || risk.severity === 'high' ? 10 
        : risk.severity === 'medium' ? 7 
        : 4,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      impact: risk.impact,
      count: risk.count,
      action: risk.fix?.action,
      route: undefined,
      filter: risk.filter,
      source: risk
    })),
    // Convert insights to unified format
    ...insights.map(insight => {
      let priority = 5; // Default medium
      if (insight.priority === 'high' || (typeof insight.priority === 'number' && insight.priority >= 80)) {
        priority = 8;
      } else if (insight.priority === 'low' || (typeof insight.priority === 'number' && insight.priority <= 40)) {
        priority = 3;
      }
      return {
        id: insight.id || `insight-${Math.random()}`,
        type: 'insight' as const,
        priority,
        category: insight.category,
        title: insight.title,
        description: insight.why || insight.description,
        impact: insight.impact,
        action: insight.action,
        route: insight.route,
        filter: insight.filter,
        relatedRisk: insight.relatedRisk,
        source: insight
      };
    })
  ].filter(item => !dismissedIds.has(item.id));

  // Categorize by urgency
  const urgent = unifiedItems.filter(item => item.priority >= 8).sort((a, b) => b.priority - a.priority);
  const quickWins = unifiedItems.filter(item => item.priority >= 5 && item.priority < 8).sort((a, b) => b.priority - a.priority);
  const strategic = unifiedItems.filter(item => item.priority < 5).sort((a, b) => b.priority - a.priority);

  const handleDismiss = async (item: UnifiedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!userProfile?.org_id) {
      toast.error('Unable to dismiss');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      if (item.type === 'insight') {
        const { error } = await supabase
          .from('dismissed_recommendations')
          .insert({
            org_id: userProfile.org_id,
            user_id: user.id,
            recommendation_id: item.id,
            recommendation_type: item.category || 'insight',
          });

        if (error) throw error;
      }

      setDismissedIds(prev => new Set([...prev, item.id]));
      toast.success('Item dismissed');
    } catch (error: any) {
      console.error('Error dismissing item:', error);
      toast.error('Failed to dismiss');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      toast.success('Insights refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleItemClick = (item: UnifiedItem) => {
    if (item.route) {
      const url = new URL(item.route, window.location.origin);
      if (item.filter) {
        Object.entries(item.filter).forEach(([key, value]) => {
          url.searchParams.set(key, String(value));
        });
      }
      navigate(url.pathname + url.search);
    } else if (item.type === 'risk' && item.route?.includes('enrich')) {
      setSelectedEnrichmentFields(['contacts']);
      setEnrichmentModalOpen(true);
    }
  };

  const getIcon = (item: UnifiedItem) => {
    if (item.type === 'risk') {
      switch (item.severity) {
        case 'critical':
        case 'high':
          return AlertTriangle;
        case 'medium':
        case 'low':
          return AlertTriangle;
        default: return Target;
      }
    }
    switch (item.category) {
      case 'revenue': return TrendingUp;
      case 'signal': return Zap;
      default: return Target;
    }
  };

  const getColorClass = (item: UnifiedItem) => {
    if (item.type === 'risk') {
      switch (item.severity) {
        case 'critical':
        case 'high':
          return 'border-executive-red/30 bg-executive-red/5 hover:bg-executive-red/10';
        case 'medium':
        case 'low':
          return 'border-executive-amber/30 bg-executive-amber/5 hover:bg-executive-amber/10';
        default: return 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10';
      }
    }
    switch (item.category) {
      case 'revenue': return 'border-executive-green/40 bg-executive-green/5 hover:bg-executive-green/10';
      case 'signal': return 'border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10';
      default: return 'border-primary/40 bg-primary/5 hover:bg-primary/10';
    }
  };

  const renderItemCard = (item: UnifiedItem) => {
    const Icon = getIcon(item);
    const colorClass = getColorClass(item);

    return (
      <div
        key={item.id}
        className={cn(
          "relative border-2 rounded-lg p-4 transition-all cursor-pointer group",
          colorClass
        )}
        onClick={() => handleItemClick(item)}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => handleDismiss(item, e)}
        >
          <X className="h-3 w-3" />
        </Button>

        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-background/80">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
              {item.type === 'risk' && item.severity && (
                <Badge 
                  variant={
                    item.severity === 'critical' || item.severity === 'high' 
                      ? 'destructive' 
                      : 'outline'
                  }
                  className="text-xs"
                >
                  {item.severity}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.description}
            </p>
            {item.relatedRisk && (
              <p className="text-xs text-primary mt-1">
                ↳ Related to: {item.relatedRisk}
              </p>
            )}
          </div>
          {item.count && (
            <div className="text-right shrink-0">
              <div className="text-xl font-bold">{item.count.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">affected</div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="text-xs font-medium text-primary">
            Impact: {item.impact}
          </div>
          {item.action && (
            <Button 
              size="sm" 
              className="w-full h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item);
              }}
            >
              {item.action}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Smart Insights & Actions
            </CardTitle>
            <CardDescription>
              AI-driven recommendations and risk mitigation prioritized by impact
            </CardDescription>
          </div>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="urgent" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="urgent" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Urgent ({urgent.length})
            </TabsTrigger>
            <TabsTrigger value="quick-wins" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Wins ({quickWins.length})
            </TabsTrigger>
            <TabsTrigger value="strategic" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Strategic ({strategic.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="urgent" className="space-y-3">
            {urgent.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {urgent.map(renderItemCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-executive-green" />
                <p className="text-sm font-medium">No urgent items</p>
                <p className="text-xs mt-1">All critical issues resolved</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quick-wins" className="space-y-3">
            {quickWins.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {quickWins.map(renderItemCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">No quick wins available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="strategic" className="space-y-3">
            {strategic.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {strategic.map(renderItemCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">No strategic items</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="pt-4 mt-4 border-t">
          <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {totalScored === 0 && (
              <Button 
                onClick={() => navigate('/icp-manager')} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <Target className="h-4 w-4 mr-2" />
                Define ICP
              </Button>
            )}
            {campaignReadyCount > 0 && (
              <Button 
                onClick={() => navigate('/accounts?campaign_ready=true')} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                View {campaignReadyCount} Campaign-Ready
              </Button>
            )}
            {completenessScore < 70 && (
              <Button 
                onClick={() => setEnrichmentModalOpen(true)} 
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Enrich Data
              </Button>
            )}
            <Button 
              onClick={() => navigate('/data-upload')} 
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>
        </div>

        <EnrichmentModal
          open={enrichmentModalOpen}
          onOpenChange={setEnrichmentModalOpen}
          targetFields={selectedEnrichmentFields}
        />
      </CardContent>
    </Card>
  );
}
