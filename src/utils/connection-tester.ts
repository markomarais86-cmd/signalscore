import { supabase } from "@/integrations/supabase/client";

export interface ConnectionTestResult {
  success: boolean;
  issue?: string;
  details?: string;
  recommendation?: string;
}

export async function testDatabaseConnection(orgId: string): Promise<ConnectionTestResult> {
  try {
    // Test 1: Basic connectivity
    const { error: pingError } = await supabase.from('organizations').select('id').limit(1);
    if (pingError) {
      return {
        success: false,
        issue: 'Database Connection Failed',
        details: pingError.message,
        recommendation: 'Check your internet connection and try refreshing the page'
      };
    }

    // Test 2: Organization access
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError) {
      return {
        success: false,
        issue: 'Organization Access Error',
        details: orgError.message,
        recommendation: 'Sign out and sign back in to refresh your session'
      };
    }

    if (!org) {
      return {
        success: false,
        issue: 'Organization Not Found',
        details: 'Your organization could not be found in the database',
        recommendation: 'Contact support to resolve this issue'
      };
    }

    // Test 3: Accounts table
    const { error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('org_id', orgId)
      .limit(1);

    if (accountsError) {
      return {
        success: false,
        issue: 'Accounts Table Error',
        details: accountsError.message,
        recommendation: 'The accounts table may not be configured correctly'
      };
    }

    // Test 4: Closed won deals table
    const { error: dealsError } = await supabase
      .from('closed_won_deals')
      .select('id')
      .limit(0);

    if (dealsError) {
      if (dealsError.message?.includes('does not exist')) {
        return {
          success: false,
          issue: 'Feature Not Enabled',
          details: 'The closed won deals feature is not enabled for your organization',
          recommendation: 'Contact support to enable closed won tracking'
        };
      }
      return {
        success: false,
        issue: 'Closed Won Deals Table Error',
        details: dealsError.message,
        recommendation: 'There may be a configuration issue with the deals table'
      };
    }

    return { success: true };

  } catch (error: any) {
    return {
      success: false,
      issue: 'Unexpected Error',
      details: error.message || 'An unknown error occurred',
      recommendation: 'Try refreshing the page. If the problem persists, contact support'
    };
  }
}

export async function getAccountStats(orgId: string): Promise<{
  totalAccounts: number;
  accountsWithDomains: number;
  recentlyUpdated: number;
}> {
  try {
    const { count: totalAccounts } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    const { count: accountsWithDomains } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('domain', 'is', null);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: recentlyUpdated } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('updated_at', thirtyDaysAgo.toISOString());

    return {
      totalAccounts: totalAccounts || 0,
      accountsWithDomains: accountsWithDomains || 0,
      recentlyUpdated: recentlyUpdated || 0
    };
  } catch (error) {
    console.error('Error getting account stats:', error);
    return {
      totalAccounts: 0,
      accountsWithDomains: 0,
      recentlyUpdated: 0
    };
  }
}
