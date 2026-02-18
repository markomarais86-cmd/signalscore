import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Rocket, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PowerUpButtonProps {
  orgId: string;
  onComplete?: () => void;
}

const STEPS = [
  { key: "enrich", label: "Enriching intent data" },
  { key: "beds", label: "Finding hospital bed counts" },
  { key: "score", label: "Scoring all accounts" },
  { key: "signals", label: "Computing intent signals" },
  { key: "insights", label: "Generating AI insights" },
] as const;

export function PowerUpButton({ orgId, onComplete }: PowerUpButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const progressPercent = isRunning ? ((currentStep + 1) / STEPS.length) * 100 : 0;

  const runPowerUp = async () => {
    if (!orgId || isRunning) return;
    setIsRunning(true);

    try {
      // Step 0: Enrich funding + tech stack (best effort)
      setCurrentStep(0);
      try {
        const { data: fundingAccounts } = await supabase
          .from("accounts")
          .select("id, name, domain")
          .eq("org_id", orgId)
          .is("last_funding_date", null)
          .not("domain", "is", null)
          .limit(50);

        if (fundingAccounts?.length) {
          await Promise.allSettled(
            fundingAccounts.slice(0, 10).map((a) =>
              supabase.functions.invoke("enrich-funding-data", {
                body: { account_id: a.id, company_name: a.name || a.domain, domain: a.domain, org_id: orgId },
              })
            )
          );
        }
      } catch { /* non-critical */ }

      // Step 1: Enrich bed counts for healthcare accounts
      setCurrentStep(1);
      try {
        // Run multiple batches of bed count enrichment
        for (let batch = 0; batch < 4; batch++) {
          const { error: bedErr } = await supabase.functions.invoke("enrich-bed-counts", {
            body: { org_id: orgId, batch_size: 50 },
          });
          if (bedErr) {
            console.error("Bed enrichment error:", bedErr);
            break;
          }
        }
      } catch { /* non-critical */ }

      // Step 2: Bulk score
      setCurrentStep(2);
      const { error: scoreErr } = await supabase.functions.invoke("bulk-score-accounts", {
        body: { org_id: orgId },
      });
      if (scoreErr) console.error("Score error:", scoreErr);

      // Wait for scoring to finish (poll)
      let scoringDone = false;
      for (let i = 0; i < 60 && !scoringDone; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data: job } = await supabase
          .from("bulk_scoring_jobs")
          .select("status")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!job || job.status === "completed" || job.status === "failed") scoringDone = true;
      }

      // Step 3: Compute intent signals for top accounts
      setCurrentStep(3);
      try {
        const { data: topAccounts } = await supabase
          .from("scores")
          .select("account_external_id")
          .eq("org_id", orgId)
          .order("overall", { ascending: false })
          .limit(100);

        if (topAccounts?.length) {
          await supabase.functions.invoke("compute-intent-signals", {
            body: {
              org_id: orgId,
              account_ids: topAccounts.map((a) => a.account_external_id),
            },
          });
        }
      } catch { /* non-critical */ }

      // Step 4: Generate AI insights for top 10
      setCurrentStep(4);
      try {
        const { data: top10 } = await supabase
          .from("scores")
          .select("account_external_id")
          .eq("org_id", orgId)
          .order("overall", { ascending: false })
          .limit(10);

        if (top10?.length) {
          await Promise.allSettled(
            top10.map((a) =>
              supabase.functions.invoke("generate-account-insights", {
                body: { org_id: orgId, account_external_id: a.account_external_id },
              })
            )
          );
        }
      } catch { /* non-critical */ }

      toast.success("Power Up complete! Your data is now fully activated.");
      onComplete?.();
    } catch (error) {
      console.error("Power Up error:", error);
      toast.error("Power Up encountered an error");
    } finally {
      setIsRunning(false);
      setCurrentStep(-1);
    }
  };

  if (isRunning) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card/80">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">{STEPS[currentStep]?.label || "Starting..."}</span>
            <span className="font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-2 w-2 rounded-full transition-colors ${
                i < currentStep ? "bg-primary" : i === currentStep ? "bg-primary animate-pulse" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={runPowerUp}
      variant="default"
      size="sm"
      className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all"
    >
      <Rocket className="mr-2 h-4 w-4" />
      Power Up
    </Button>
  );
}
