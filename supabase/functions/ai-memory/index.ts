import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemoryEntry {
  key: string;
  value: any;
  type: 'conversation' | 'preference' | 'template' | 'context';
  confidence?: number;
  learnedFrom?: string[];
  expiresAt?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's auth for validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    
    // Create service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's org
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', userId)
      .single();

    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...params } = await req.json();

    let result;

    switch (action) {
      case 'save':
        result = await saveMemory(supabase, userId, profile.org_id, params);
        break;
      case 'load':
        result = await loadMemory(supabase, userId, profile.org_id, params);
        break;
      case 'learn_preference':
        result = await learnPreference(supabase, userId, profile.org_id, params);
        break;
      case 'get_preferences':
        result = await getPreferences(supabase, userId, profile.org_id);
        break;
      case 'save_template':
        result = await saveTemplate(supabase, userId, profile.org_id, params);
        break;
      case 'get_templates':
        result = await getTemplates(supabase, profile.org_id, params);
        break;
      case 'get_suggestions':
        result = await getSuggestions(supabase, userId, profile.org_id, params);
        break;
      case 'clear':
        result = await clearMemory(supabase, userId, profile.org_id, params);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI Memory error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Save memory entry
async function saveMemory(
  supabase: any,
  userId: string,
  orgId: string,
  params: { entries: MemoryEntry[] }
): Promise<{ saved: number }> {
  const { entries } = params;
  let savedCount = 0;

  for (const entry of entries) {
    const { error } = await supabase
      .from('ai_memory')
      .upsert({
        user_id: userId,
        org_id: orgId,
        memory_key: entry.key,
        memory_type: entry.type,
        memory_value: entry.value,
        preference_type: entry.type === 'preference' ? entry.key : null,
        confidence: entry.confidence || 0.5,
        learned_from: entry.learnedFrom || [],
        expires_at: entry.expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,user_id,memory_key',
      });

    if (!error) savedCount++;
  }

  return { saved: savedCount };
}

// Load memory entries
async function loadMemory(
  supabase: any,
  userId: string,
  orgId: string,
  params: { keys?: string[]; types?: string[] }
): Promise<{ entries: any[] }> {
  let query = supabase
    .from('ai_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (params.keys?.length) {
    query = query.in('memory_key', params.keys);
  }

  if (params.types?.length) {
    query = query.in('memory_type', params.types);
  }

  // Filter out expired entries
  query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  const { data, error } = await query;

  if (error) throw error;

  return {
    entries: (data || []).map((row: any) => ({
      key: row.memory_key,
      type: row.memory_type,
      value: row.memory_value,
      confidence: row.confidence,
      learnedFrom: row.learned_from,
      updatedAt: row.updated_at,
    })),
  };
}

// Learn a preference from user action
async function learnPreference(
  supabase: any,
  userId: string,
  orgId: string,
  params: { 
    preference: string;
    value: any;
    source: string;
    confidence?: number;
  }
): Promise<{ learned: boolean }> {
  const { preference, value, source, confidence = 0.7 } = params;

  // Check if preference exists
  const { data: existing } = await supabase
    .from('ai_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('memory_key', `pref_${preference}`)
    .single();

  if (existing) {
    // Update with higher confidence
    const newConfidence = Math.min(0.99, existing.confidence + 0.1);
    const learnedFrom = [...new Set([...(existing.learned_from || []), source])];

    await supabase
      .from('ai_memory')
      .update({
        memory_value: value,
        confidence: newConfidence,
        learned_from: learnedFrom,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Create new preference
    await supabase.from('ai_memory').insert({
      user_id: userId,
      org_id: orgId,
      memory_key: `pref_${preference}`,
      memory_type: 'preference',
      memory_value: value,
      preference_type: preference,
      confidence,
      learned_from: [source],
    });
  }

  return { learned: true };
}

// Get all preferences for a user
async function getPreferences(
  supabase: any,
  userId: string,
  orgId: string
): Promise<{ preferences: Record<string, any> }> {
  const { data } = await supabase
    .from('ai_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('memory_type', 'preference')
    .gte('confidence', 0.5);

  const preferences: Record<string, any> = {};
  for (const row of data || []) {
    const key = row.memory_key.replace('pref_', '');
    preferences[key] = {
      value: row.memory_value,
      confidence: row.confidence,
    };
  }

  return { preferences };
}

// Save action template
async function saveTemplate(
  supabase: any,
  userId: string,
  orgId: string,
  params: {
    name: string;
    description?: string;
    actionType: string;
    parameters: any;
  }
): Promise<{ templateId: string }> {
  const { name, description, actionType, parameters } = params;

  const { data, error } = await supabase
    .from('ai_action_templates')
    .insert({
      org_id: orgId,
      user_id: userId,
      name,
      description,
      action_type: actionType,
      parameters,
    })
    .select('id')
    .single();

  if (error) throw error;

  return { templateId: data.id };
}

// Get templates
async function getTemplates(
  supabase: any,
  orgId: string,
  params: { actionType?: string; limit?: number }
): Promise<{ templates: any[] }> {
  let query = supabase
    .from('ai_action_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('usage_count', { ascending: false })
    .limit(params.limit || 10);

  if (params.actionType) {
    query = query.eq('action_type', params.actionType);
  }

  const { data } = await query;

  return {
    templates: (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      actionType: t.action_type,
      parameters: t.parameters,
      usageCount: t.usage_count,
      lastUsed: t.last_used_at,
    })),
  };
}

// Generate smart suggestions based on history
async function getSuggestions(
  supabase: any,
  userId: string,
  orgId: string,
  params: { context?: string; limit?: number }
): Promise<{ suggestions: any[] }> {
  const suggestions: any[] = [];

  // Get recent successful actions
  const { data: recentActions } = await supabase
    .from('ai_action_logs')
    .select('action_name, action_parameters')
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);

  // Get popular templates
  const { data: templates } = await supabase
    .from('ai_action_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('usage_count', { ascending: false })
    .limit(5);

  // Get user preferences
  const { preferences } = await getPreferences(supabase, userId, orgId);

  // Build suggestions from templates
  for (const template of templates || []) {
    suggestions.push({
      type: 'template',
      text: template.name,
      description: template.description || `Run ${template.action_type}`,
      action: template.action_type,
      parameters: template.parameters,
      confidence: 0.9,
    });
  }

  // Build suggestions from recent patterns
  const actionCounts: Record<string, number> = {};
  for (const action of recentActions || []) {
    actionCounts[action.action_name] = (actionCounts[action.action_name] || 0) + 1;
  }

  const frequentActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [actionName, count] of frequentActions) {
    if (!suggestions.find(s => s.action === actionName)) {
      suggestions.push({
        type: 'frequent',
        text: `Run ${actionName.replace(/_/g, ' ')}`,
        description: `You've used this ${count} times recently`,
        action: actionName,
        confidence: Math.min(0.8, 0.5 + count * 0.05),
      });
    }
  }

  // Add preference-based suggestions
  if (preferences.preferred_enrichment_provider) {
    suggestions.push({
      type: 'preference',
      text: `Enrich with ${preferences.preferred_enrichment_provider.value}`,
      description: 'Based on your preferences',
      action: 'enrich_accounts',
      parameters: { provider: preferences.preferred_enrichment_provider.value },
      confidence: preferences.preferred_enrichment_provider.confidence,
    });
  }

  return {
    suggestions: suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, params.limit || 5),
  };
}

// Clear memory
async function clearMemory(
  supabase: any,
  userId: string,
  orgId: string,
  params: { types?: string[]; all?: boolean }
): Promise<{ cleared: number }> {
  let query = supabase
    .from('ai_memory')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (params.types?.length && !params.all) {
    query = query.in('memory_type', params.types);
  }

  const { count } = await query;

  return { cleared: count || 0 };
}
