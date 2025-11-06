import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookLog {
  id: string;
  webhook_type: string;
  object_type: string;
  record_id: string;
  action: string;
  payload: any;
  retry_count: number;
  max_retries: number;
  org_id: string;
}

// Calculate exponential backoff delay
function calculateBackoffDelay(retryCount: number): number {
  // Base delay: 1 minute
  // Formula: baseDelay * (2 ^ retryCount)
  // Retry 1: 2 minutes
  // Retry 2: 4 minutes
  // Retry 3: 8 minutes
  const baseDelayMs = 60 * 1000; // 1 minute
  return baseDelayMs * Math.pow(2, retryCount);
}

async function processWebhookPayload(
  supabase: any,
  webhook: WebhookLog
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[retry-webhooks] Processing ${webhook.object_type} - ${webhook.action} for record ${webhook.record_id}`);

    const payload = webhook.payload;

    if (webhook.object_type === 'Account') {
      // Process Account update/create/delete
      const accountData = {
        org_id: webhook.org_id,
        external_id: webhook.record_id,
        name: payload.Name,
        domain: payload.Website,
        industry_raw: payload.Industry,
        industry_norm: payload.Industry,
        employee_count: payload.NumberOfEmployees ? parseInt(payload.NumberOfEmployees) : null,
        revenue_range: payload.AnnualRevenue ? `$${payload.AnnualRevenue}` : null,
        country: payload.BillingCountry,
        state_province: payload.BillingState,
        phone: payload.Phone,
        data_source: 'crm',
      };

      if (webhook.action === 'delete') {
        await supabase
          .from('accounts')
          .delete()
          .eq('org_id', webhook.org_id)
          .eq('external_id', webhook.record_id);
      } else {
        await supabase
          .from('accounts')
          .upsert(accountData, { onConflict: 'org_id,external_id' });
      }
    } else if (webhook.object_type === 'Contact') {
      // Process Contact update/create/delete
      const contactData = {
        org_id: webhook.org_id,
        external_id: webhook.record_id,
        account_external_id: payload.AccountId,
        first_name: payload.FirstName,
        last_name: payload.LastName,
        email: payload.Email,
        title_raw: payload.Title,
        phone: payload.Phone,
        mobile: payload.MobilePhone,
      };

      if (webhook.action === 'delete') {
        await supabase
          .from('contacts')
          .delete()
          .eq('org_id', webhook.org_id)
          .eq('external_id', webhook.record_id);
      } else {
        await supabase
          .from('contacts')
          .upsert(contactData, { onConflict: 'org_id,external_id' });
      }
    } else if (webhook.object_type === 'Lead') {
      // Process Lead update/create/delete
      const leadData = {
        org_id: webhook.org_id,
        external_id: webhook.record_id,
        name: `${payload.FirstName || ''} ${payload.LastName || ''}`.trim(),
        email: payload.Email,
        first_name: payload.FirstName,
        last_name: payload.LastName,
        company: payload.Company,
        title: payload.Title,
        phone: payload.Phone,
        status: payload.Status,
      };

      if (webhook.action === 'delete') {
        await supabase
          .from('Leads')
          .delete()
          .eq('org_id', webhook.org_id)
          .eq('external_id', webhook.record_id);
      } else {
        await supabase
          .from('Leads')
          .upsert(leadData, { onConflict: 'org_id,external_id' });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error(`[retry-webhooks] Error processing webhook ${webhook.id}:`, error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[retry-webhooks] Starting webhook retry job');

    // Find webhooks that need retry
    const { data: webhooksToRetry, error: fetchError } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('processed', false)
      .eq('permanently_failed', false)
      .lte('next_retry_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50); // Process up to 50 webhooks per run

    if (fetchError) {
      console.error('[retry-webhooks] Error fetching webhooks:', fetchError);
      throw fetchError;
    }

    if (!webhooksToRetry || webhooksToRetry.length === 0) {
      console.log('[retry-webhooks] No webhooks to retry');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No webhooks to retry',
          retried: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[retry-webhooks] Found ${webhooksToRetry.length} webhooks to retry`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;
    let permanentlyFailedCount = 0;

    for (const webhook of webhooksToRetry) {
      const currentRetry = webhook.retry_count + 1;
      const maxRetries = webhook.max_retries || 3;

      console.log(`[retry-webhooks] Retrying webhook ${webhook.id} (attempt ${currentRetry}/${maxRetries})`);

      // Update last retry timestamp
      await supabase
        .from('webhook_logs')
        .update({ last_retry_at: new Date().toISOString() })
        .eq('id', webhook.id);

      // Attempt to process the webhook
      const result = await processWebhookPayload(supabase, webhook);

      if (result.success) {
        // Success - mark as processed
        await supabase
          .from('webhook_logs')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            retry_count: currentRetry,
            failure_reason: null
          })
          .eq('id', webhook.id);

        successCount++;
        results.push({
          webhook_id: webhook.id,
          object_type: webhook.object_type,
          status: 'success',
          retry_count: currentRetry
        });

        console.log(`[retry-webhooks] Successfully processed webhook ${webhook.id} on retry ${currentRetry}`);
      } else {
        // Failed - check if we should retry again or mark as permanently failed
        if (currentRetry >= maxRetries) {
          // Permanently failed - no more retries
          await supabase
            .from('webhook_logs')
            .update({
              permanently_failed: true,
              retry_count: currentRetry,
              failure_reason: result.error || 'Max retries exceeded',
              next_retry_at: null
            })
            .eq('id', webhook.id);

          permanentlyFailedCount++;
          results.push({
            webhook_id: webhook.id,
            object_type: webhook.object_type,
            status: 'permanently_failed',
            retry_count: currentRetry,
            error: result.error
          });

          console.error(`[retry-webhooks] Webhook ${webhook.id} permanently failed after ${currentRetry} retries`);
        } else {
          // Schedule next retry with exponential backoff
          const backoffDelay = calculateBackoffDelay(currentRetry);
          const nextRetryAt = new Date(Date.now() + backoffDelay);

          await supabase
            .from('webhook_logs')
            .update({
              retry_count: currentRetry,
              next_retry_at: nextRetryAt.toISOString(),
              failure_reason: result.error
            })
            .eq('id', webhook.id);

          failedCount++;
          results.push({
            webhook_id: webhook.id,
            object_type: webhook.object_type,
            status: 'retry_scheduled',
            retry_count: currentRetry,
            next_retry_at: nextRetryAt.toISOString(),
            error: result.error
          });

          console.log(`[retry-webhooks] Webhook ${webhook.id} retry ${currentRetry} failed, next retry at ${nextRetryAt.toISOString()}`);
        }
      }
    }

    console.log(`[retry-webhooks] Completed: ${successCount} successful, ${failedCount} retry scheduled, ${permanentlyFailedCount} permanently failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Retry completed: ${successCount} successful, ${failedCount} retry scheduled, ${permanentlyFailedCount} permanently failed`,
        processed: successCount,
        retry_scheduled: failedCount,
        permanently_failed: permanentlyFailedCount,
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[retry-webhooks] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
