import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIBriefCardProps {
  orgId: string;
  totalAccounts: number;
  scoredAccounts: number;
  highFitAccounts: number;
  campaignReadyAccounts: number;
  dataCompleteness: number;
}

const CACHE_KEY = "ai-brief-cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedBrief {
  text: string;
  orgId: string;
  timestamp: number;
}

export function AIBriefCard({
  orgId,
  totalAccounts,
  scoredAccounts,
  highFitAccounts,
  campaignReadyAccounts,
  dataCompleteness,
}: AIBriefCardProps) {
  const [brief, setBrief] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedBrief = JSON.parse(cached);
        if (parsed.orgId === orgId && Date.now() - parsed.timestamp < CACHE_TTL) {
          setBrief(parsed.text);
          return;
        }
      }
    } catch {}

    // Auto-generate if we have data
    if (totalAccounts > 0 && !isLoading) {
      generateBrief();
    }
  }, [orgId, totalAccounts]);

  const generateBrief = async () => {
    if (isLoading || totalAccounts === 0) return;
    setIsLoading(true);

    try {
      const prompt = `You are an executive revenue strategist. Give a 2-3 sentence briefing based on this data:
- ${totalAccounts.toLocaleString()} total accounts, ${scoredAccounts.toLocaleString()} scored
- ${highFitAccounts.toLocaleString()} high-fit accounts, ${campaignReadyAccounts.toLocaleString()} campaign-ready
- Data completeness: ${dataCompleteness}%
Focus on the single most impactful action to take today. Be direct and specific.`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
          context: "Executive dashboard briefing",
        },
      });

      if (error) throw error;

      const text = typeof data === "string" ? data : data?.response || data?.message || data?.content || "Unable to generate brief.";
      setBrief(text);

      // Cache it
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ text, orgId, timestamp: Date.now() } satisfies CachedBrief)
      );
    } catch (err) {
      console.error("AI Brief error:", err);
      // Fallback brief
      const fallback = highFitAccounts > 0
        ? `You have ${highFitAccounts.toLocaleString()} high-fit accounts ready for outreach. ${dataCompleteness < 70 ? "Enriching your data would improve scoring accuracy." : "Focus on campaign-ready accounts for maximum impact."}`
        : `${totalAccounts.toLocaleString()} accounts loaded. Run scoring to identify your highest-potential targets.`;
      setBrief(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  if (!brief && !isLoading) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5">
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-primary/10 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary uppercase tracking-wide">AI Brief</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  localStorage.removeItem(CACHE_KEY);
                  generateBrief();
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <p className="text-sm text-foreground leading-relaxed">{brief}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
