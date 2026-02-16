import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrichmentProgress {
  phase: "idle" | "funding" | "tech_stack" | "done";
  current: number;
  total: number;
}

export function useIntentEnrichment(orgId: string | undefined) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState<EnrichmentProgress>({
    phase: "idle",
    current: 0,
    total: 0,
  });

  const enrichWithConcurrency = async (
    items: { id: string; name: string | null; domain: string | null }[],
    functionName: string,
    phase: "funding" | "tech_stack",
    concurrency = 3
  ) => {
    setProgress({ phase, current: 0, total: items.length });
    let completed = 0;

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            await supabase.functions.invoke(functionName, {
              body: {
                account_id: item.id,
                company_name: item.name || item.domain,
                domain: item.domain,
                org_id: orgId,
              },
            });
          } catch (e) {
            console.error(`Failed to enrich ${item.name}:`, e);
          }
        })
      );
      completed += batch.length;
      setProgress({ phase, current: completed, total: items.length });
    }
  };

  const runEnrichment = useCallback(async () => {
    if (!orgId || isEnriching) return;
    setIsEnriching(true);

    try {
      // Phase 1: Funding enrichment
      const { data: fundingAccounts } = await supabase
        .from("accounts")
        .select("id, name, domain")
        .eq("org_id", orgId)
        .is("last_funding_date", null)
        .not("domain", "is", null)
        .limit(100);

      if (fundingAccounts && fundingAccounts.length > 0) {
        toast.info(`Enriching funding data for ${fundingAccounts.length} accounts...`);
        await enrichWithConcurrency(fundingAccounts, "enrich-funding-data", "funding");
      }

      // Phase 2: Tech stack enrichment
      const { data: techAccounts } = await supabase
        .from("accounts")
        .select("id, name, domain")
        .eq("org_id", orgId)
        .not("domain", "is", null)
        .or("tech_stack.is.null,tech_stack.eq.{}")
        .limit(100);

      if (techAccounts && techAccounts.length > 0) {
        toast.info(`Enriching tech stack for ${techAccounts.length} accounts...`);
        await enrichWithConcurrency(techAccounts, "enrich-tech-stack", "tech_stack");
      }

      setProgress({ phase: "done", current: 0, total: 0 });
      toast.success("Intent data enrichment complete!");
    } catch (error) {
      console.error("Enrichment error:", error);
      toast.error("Enrichment failed");
    } finally {
      setIsEnriching(false);
    }
  }, [orgId, isEnriching]);

  return { isEnriching, progress, runEnrichment };
}
