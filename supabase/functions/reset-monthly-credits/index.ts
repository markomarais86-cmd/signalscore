import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Organization {
  id: string;
  name: string;
  plan_id: string | null;
  enrichment_credits_used: number;
  enrichment_credits_total: number | null;
  enrichment_credits_bonus: number;
  enrichment_credits_reset_at: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting monthly credit reset job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all organizations that need credit reset
    const now = new Date();
    const { data: organizations, error: fetchError } = await supabase
      .from("organizations")
      .select("id, name, plan_id, enrichment_credits_used, enrichment_credits_total, enrichment_credits_bonus, enrichment_credits_reset_at")
      .or(`enrichment_credits_reset_at.is.null,enrichment_credits_reset_at.lte.${now.toISOString()}`);

    if (fetchError) {
      console.error("Error fetching organizations:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${organizations?.length || 0} organizations to process`);

    const results = {
      processed: 0,
      reset: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Calculate next reset date (1st of next month)
    const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextResetDate.setUTCHours(0, 0, 0, 0);

    for (const org of (organizations || []) as Organization[]) {
      results.processed++;

      try {
        // Skip enterprise (unlimited) organizations - they don't need resets
        // Enterprise plans have null credits total
        if (org.enrichment_credits_total === null) {
          console.log(`Skipping ${org.name} (Enterprise/unlimited plan)`);
          results.skipped++;
          continue;
        }

        // Skip if no credits were used
        if (org.enrichment_credits_used === 0) {
          // Still update the reset date
          await supabase
            .from("organizations")
            .update({ enrichment_credits_reset_at: nextResetDate.toISOString() })
            .eq("id", org.id);
          
          console.log(`Skipping ${org.name} (no credits used, updated reset date)`);
          results.skipped++;
          continue;
        }

        // Log the adjustment before reset
        const { error: logError } = await supabase
          .from("credit_adjustments")
          .insert({
            org_id: org.id,
            adjustment_type: "reset",
            previous_used: org.enrichment_credits_used,
            previous_total: org.enrichment_credits_total,
            previous_bonus: org.enrichment_credits_bonus,
            new_used: 0,
            new_total: org.enrichment_credits_total,
            new_bonus: org.enrichment_credits_bonus, // Bonus credits persist
            reason: `Monthly credit reset for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            performed_by: "system",
          });

        if (logError) {
          console.error(`Error logging adjustment for ${org.name}:`, logError);
        }

        // Reset the credits
        const { error: updateError } = await supabase
          .from("organizations")
          .update({
            enrichment_credits_used: 0,
            enrichment_credits_reset_at: nextResetDate.toISOString(),
          })
          .eq("id", org.id);

        if (updateError) {
          console.error(`Error resetting credits for ${org.name}:`, updateError);
          results.errors.push(`${org.name}: ${updateError.message}`);
          continue;
        }

        console.log(`Reset credits for ${org.name}: ${org.enrichment_credits_used} -> 0`);
        results.reset++;

      } catch (orgError) {
        const errorMsg = orgError instanceof Error ? orgError.message : String(orgError);
        console.error(`Error processing ${org.name}:`, errorMsg);
        results.errors.push(`${org.name}: ${errorMsg}`);
      }
    }

    console.log("Monthly credit reset completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Monthly credit reset completed",
        results,
        nextResetDate: nextResetDate.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Fatal error in reset-monthly-credits:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
