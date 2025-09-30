import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateKeyRequest {
  name: string;
  scopes?: string[];
  expires_in_days?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'admin') {
      throw new Error('Admin privileges required');
    }

    const { name, scopes = ['read'], expires_in_days }: GenerateKeyRequest = await req.json();

    // Generate a random API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const apiKey = Array.from(keyBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const fullKey = `sk_${apiKey}`;
    const keyPrefix = `sk_${apiKey.substring(0, 8)}`;

    // Hash the key for storage
    const encoder = new TextEncoder();
    const keyData = encoder.encode(fullKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Calculate expiry date if specified
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expires_in_days);
      expiresAt = expiry.toISOString();
    }

    // Store in database
    const { error: insertError } = await supabaseClient
      .from('api_keys')
      .insert({
        org_id: userProfile.org_id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        expires_at: expiresAt,
        created_by: user.id,
      });

    if (insertError) throw insertError;

    console.log(`API key generated: ${name} (${keyPrefix}...)`);

    return new Response(
      JSON.stringify({
        success: true,
        api_key: fullKey,
        key_prefix: keyPrefix,
        message: 'API key generated. Store it securely - it will not be shown again.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error generating API key:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
