import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Database, Loader2, RefreshCw, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmbeddingsStatusWidgetProps {
  orgId: string;
}

interface EmbeddingsStats {
  totalEmbeddings: number;
  accountEmbeddings: number;
  leadEmbeddings: number;
  totalAccounts: number;
  totalLeads: number;
}

export function EmbeddingsStatusWidget({ orgId }: EmbeddingsStatusWidgetProps) {
  const [stats, setStats] = useState<EmbeddingsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Get embedding counts
      const { count: totalEmbeddings } = await supabase
        .from("document_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      const { count: accountEmbeddings } = await supabase
        .from("document_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("source_type", "account");

      const { count: leadEmbeddings } = await supabase
        .from("document_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("source_type", "lead");

      // Get total record counts
      const { count: totalAccounts } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      const { count: totalLeads } = await supabase
        .from("Leads")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      setStats({
        totalEmbeddings: totalEmbeddings || 0,
        accountEmbeddings: accountEmbeddings || 0,
        leadEmbeddings: leadEmbeddings || 0,
        totalAccounts: totalAccounts || 0,
        totalLeads: totalLeads || 0,
      });
    } catch (error) {
      console.error("Failed to load embeddings stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [orgId]);

  const handleGenerateEmbeddings = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-generate-embeddings", {
        body: {
          org_id: orgId,
          source_type: "all",
          batch_size: 100,
        },
      });

      if (error) throw error;

      toast({
        title: "Embeddings Generated",
        description: `Successfully processed ${data.successful}/${data.processed} records`,
      });

      await loadStats();
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate embeddings",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const accountCoverage = stats?.totalAccounts 
    ? Math.round((stats.accountEmbeddings / stats.totalAccounts) * 100) 
    : 0;
  const leadCoverage = stats?.totalLeads 
    ? Math.round((stats.leadEmbeddings / stats.totalLeads) * 100) 
    : 0;

  const getStatusBadge = (coverage: number) => {
    if (coverage >= 90) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Indexed</Badge>;
    }
    if (coverage >= 50) {
      return <Badge variant="secondary" className="bg-yellow-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
    }
    return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Not Indexed</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Semantic Search Index
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadStats}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateEmbeddings}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-1" />
                  Index Data
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Accounts</span>
              {getStatusBadge(accountCoverage)}
            </div>
            <Progress value={accountCoverage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {stats?.accountEmbeddings.toLocaleString()} / {stats?.totalAccounts.toLocaleString()} indexed
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Leads</span>
              {getStatusBadge(leadCoverage)}
            </div>
            <Progress value={leadCoverage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {stats?.leadEmbeddings.toLocaleString()} / {stats?.totalLeads.toLocaleString()} indexed
            </div>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Embeddings</span>
            <span className="font-medium">{stats?.totalEmbeddings.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
