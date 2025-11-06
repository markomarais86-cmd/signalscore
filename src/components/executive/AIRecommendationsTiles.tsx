import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, Target, Zap, AlertTriangle, CheckCircle2, X, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface Insight {
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
}

interface AIRecommendationsTilesProps {
  insights: Insight[];
  onRefresh?: () => void;
}

const getIconForCategory = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'revenue':
      return TrendingUp;
    case 'firmographic':
      return Target;
    case 'signal':
      return Zap;
    case 'quality':
      return AlertTriangle;
    case 'growth':
      return TrendingUp;
    case 'efficiency':
      return Zap;
    default:
      return Target;
  }
};

const getColorForCategory = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'revenue':
      return 'border-executive-green/40 bg-executive-green/5 hover:bg-executive-green/10';
    case 'firmographic':
      return 'border-primary/40 bg-primary/5 hover:bg-primary/10';
    case 'signal':
      return 'border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10';
    case 'quality':
      return 'border-executive-amber/40 bg-executive-amber/5 hover:bg-executive-amber/10';
    case 'growth':
      return 'border-executive-green/40 bg-executive-green/5 hover:bg-executive-green/10';
    case 'efficiency':
      return 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10';
    default:
      return 'border-border bg-muted/30 hover:bg-muted/50';
  }
};

export function AIRecommendationsTiles({ insights, onRefresh }: AIRecommendationsTilesProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDismiss = async (insight: Insight, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!insight.id || !userProfile?.org_id) {
      toast.error('Unable to dismiss recommendation');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      const { error } = await supabase
        .from('dismissed_recommendations')
        .insert({
          org_id: userProfile.org_id,
          user_id: user.id,
          recommendation_id: insight.id,
          recommendation_type: insight.category || insight.type,
        });

      if (error) throw error;

      setDismissedIds(prev => new Set([...prev, insight.id!]));
      toast.success('Recommendation dismissed');
    } catch (error: any) {
      console.error('Error dismissing recommendation:', error);
      toast.error('Failed to dismiss recommendation');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      toast.success('Recommendations refreshed');
    } catch (error) {
      toast.error('Failed to refresh recommendations');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(insights.map(i => i.category).filter(Boolean)))];
  
  // Filter insights by selected category and dismissed status
  const filteredInsights = (selectedCategory === 'all' 
    ? insights 
    : insights.filter(i => i.category === selectedCategory)
  ).filter(i => !dismissedIds.has(i.id || ''));

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI-Powered Recommendations
          </CardTitle>
          <CardDescription>
            No recommendations available yet - score more accounts to get insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/accounts?action=score')} className="w-full">
            Score Accounts
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>
              Actionable insights based on your data and ICP
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
        {/* Category Filter Pills */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter by:</span>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer capitalize"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInsights.slice(0, 6).map((insight, idx) => {
            const Icon = getIconForCategory(insight.category);
            const colorClass = getColorForCategory(insight.category);
            
            const handleClick = () => {
              if (insight.route) {
                const url = new URL(insight.route, window.location.origin);
                if (insight.filter) {
                  Object.entries(insight.filter).forEach(([key, value]) => {
                    url.searchParams.set(key, String(value));
                  });
                }
                navigate(url.pathname + url.search);
              }
            };
            
            return (
              <div
                key={insight.id || idx}
                className={`relative border-2 rounded-lg p-4 transition-all cursor-pointer group ${colorClass}`}
                onClick={handleClick}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => handleDismiss(insight, e)}
                >
                  <X className="h-3 w-3" />
                </Button>
                
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-background/80">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {(insight.priority === 'high' || (typeof insight.priority === 'number' && insight.priority >= 80)) && (
                      <Badge variant="destructive" className="text-xs">
                        High Priority
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {insight.category || insight.type}
                    </Badge>
                  </div>
                </div>
                
                <h4 className="font-semibold text-sm mb-2 line-clamp-1">
                  {insight.title}
                </h4>
                
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {insight.why || insight.description}
                </p>
                
                <div className="pt-2 border-t space-y-2">
                  <div className="text-xs font-medium text-primary">
                    Impact: {insight.impact}
                  </div>
                  {insight.action && (
                    <Button 
                      size="sm" 
                      className="w-full h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClick();
                      }}
                    >
                      {insight.action}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
