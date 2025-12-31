import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { contactsLogger } from '@/lib/logger';

export type ContactProvider = 'apollo' | 'pdl' | 'none';

interface ProviderStatus {
  apollo: {
    configured: boolean;
    apiAccessible: boolean;
    creditsRemaining: number | null;
    error?: string;
  };
  pdl: {
    configured: boolean;
    apiAccessible: boolean;
    error?: string;
  };
}

interface PreviewResult {
  success: boolean;
  provider: ContactProvider;
  total_available: number;
  sample_titles: string[];
  seniority_breakdown: Record<string, number>;
  message: string;
  error?: string;
}

interface RedemptionResult {
  success: boolean;
  provider: ContactProvider;
  contacts_redeemed: number;
  contacts_skipped_duplicate: number;
  credits_used: number;
  message: string;
  error?: string;
}

export function useContactProvider() {
  const { userProfile } = useAuth();
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    apollo: { configured: false, apiAccessible: false, creditsRemaining: null },
    pdl: { configured: false, apiAccessible: false }
  });
  const [activeProvider, setActiveProvider] = useState<ContactProvider>('none');
  const [isLoading, setIsLoading] = useState(false);

  // Check both providers and determine which to use
  const checkProviders = useCallback(async (): Promise<ContactProvider> => {
    if (!userProfile?.org_id) return 'none';

    setIsLoading(true);
    
    try {
      // Check Apollo first
      const { data: apolloData } = await supabase.functions.invoke('get-apollo-credits', {
        body: { org_id: userProfile.org_id }
      });

      const apolloStatus = {
        configured: apolloData?.configured || false,
        apiAccessible: apolloData?.api_accessible !== false && !apolloData?.error,
        creditsRemaining: apolloData?.credits_remaining ?? null,
        error: apolloData?.error
      };

      // Check PDL (simple test call)
      let pdlStatus = { configured: false, apiAccessible: false, error: undefined as string | undefined };
      
      try {
        const { data: pdlData, error: pdlError } = await supabase.functions.invoke('search-pdl-contacts', {
          body: { 
            org_id: userProfile.org_id,
            domains: ['example.com'], // Test domain
            max_contacts: 1
          }
        });
        
        pdlStatus = {
          configured: pdlData?.configured !== false,
          apiAccessible: pdlData?.api_accessible !== false && !pdlError,
          error: pdlData?.error || pdlError?.message
        };
      } catch (e) {
        // PDL not available
      }

      setProviderStatus({ apollo: apolloStatus, pdl: pdlStatus });

      // Determine active provider
      let provider: ContactProvider = 'none';
      
      if (apolloStatus.configured && apolloStatus.apiAccessible) {
        provider = 'apollo';
      } else if (pdlStatus.configured && pdlStatus.apiAccessible) {
        provider = 'pdl';
      } else if (apolloStatus.configured) {
        // Apollo configured but not accessible (403 error) - try PDL
        provider = pdlStatus.configured ? 'pdl' : 'none';
      }

      setActiveProvider(provider);
      return provider;
    } catch (error) {
      contactsLogger.error('Error checking providers:', error);
      return 'none';
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.org_id]);

  // Preview contacts from the best available provider
  const previewContacts = useCallback(async (params: {
    domains?: string[];
    icp_criteria?: {
      industries?: string[];
      geographies?: string[];
      company_sizes?: number[];
      revenue_ranges?: string[];
    };
    persona_filters?: string[];
  }): Promise<PreviewResult> => {
    if (!userProfile?.org_id) {
      return { success: false, provider: 'none', total_available: 0, sample_titles: [], seniority_breakdown: {}, message: 'Not authenticated', error: 'Not authenticated' };
    }

    // Try Apollo first
    if (providerStatus.apollo.configured) {
      try {
        const functionName = params.icp_criteria ? 'search-apollo-by-icp' : 'preview-apollo-contacts';
        const body = params.icp_criteria 
          ? { ...params.icp_criteria, persona_filters: params.persona_filters }
          : { domains: params.domains, persona_filters: params.persona_filters };

        const { data, error } = await supabase.functions.invoke(functionName, { body });

        if (!error && data?.success) {
          return {
            success: true,
            provider: 'apollo',
            total_available: data.total_available || 0,
            sample_titles: data.sample_titles || [],
            seniority_breakdown: data.seniority_breakdown || {},
            message: data.message || ''
          };
        }

        // Apollo failed with 403 or other error - try PDL
        contactsLogger.debug('Apollo preview failed, trying PDL:', data?.error || error);
      } catch (e) {
        contactsLogger.debug('Apollo preview error:', e);
      }
    }

    // Try PDL as fallback
    if (providerStatus.pdl.configured || !providerStatus.apollo.configured) {
      try {
        const { data, error } = await supabase.functions.invoke('search-pdl-contacts', {
          body: {
            org_id: userProfile.org_id,
            domains: params.domains,
            icp_criteria: params.icp_criteria,
            persona_filters: params.persona_filters,
            max_contacts: 1 // Preview only
          }
        });

        if (!error && data?.success) {
          return {
            success: true,
            provider: 'pdl',
            total_available: data.total_available || 0,
            sample_titles: data.sample_titles || [],
            seniority_breakdown: data.seniority_breakdown || {},
            message: data.message || ''
          };
        }

        return {
          success: false,
          provider: 'pdl',
          total_available: 0,
          sample_titles: [],
          seniority_breakdown: {},
          message: data?.error || 'PDL preview failed',
          error: data?.error
        };
      } catch (e: any) {
        return {
          success: false,
          provider: 'none',
          total_available: 0,
          sample_titles: [],
          seniority_breakdown: {},
          message: 'No contact providers available',
          error: e.message
        };
      }
    }

    return {
      success: false,
      provider: 'none',
      total_available: 0,
      sample_titles: [],
      seniority_breakdown: {},
      message: 'No contact providers configured',
      error: 'No providers available'
    };
  }, [userProfile?.org_id, providerStatus]);

  // Redeem contacts from the best available provider
  const redeemContacts = useCallback(async (params: {
    domains?: string[];
    icp_criteria?: {
      industries?: string[];
      geographies?: string[];
      company_sizes?: number[];
      revenue_ranges?: string[];
    };
    persona_filters?: string[];
    max_contacts: number;
    campaign_name?: string;
  }): Promise<RedemptionResult> => {
    if (!userProfile?.org_id) {
      return { success: false, provider: 'none', contacts_redeemed: 0, contacts_skipped_duplicate: 0, credits_used: 0, message: 'Not authenticated', error: 'Not authenticated' };
    }

    // Try Apollo first if accessible
    if (providerStatus.apollo.configured && providerStatus.apollo.apiAccessible) {
      try {
        const functionName = params.icp_criteria ? 'redeem-apollo-by-icp' : 'redeem-apollo-contacts';
        const body = params.icp_criteria 
          ? {
              org_id: userProfile.org_id,
              icp_criteria: params.icp_criteria,
              persona_filters: params.persona_filters,
              max_contacts: params.max_contacts,
              campaign_name: params.campaign_name
            }
          : {
              org_id: userProfile.org_id,
              account_domains: params.domains,
              persona_filters: params.persona_filters,
              max_contacts: params.max_contacts,
              campaign_name: params.campaign_name
            };

        const { data, error } = await supabase.functions.invoke(functionName, { body });

        if (!error && data?.success) {
          return {
            success: true,
            provider: 'apollo',
            contacts_redeemed: data.contacts_redeemed || 0,
            contacts_skipped_duplicate: data.contacts_skipped_duplicate || 0,
            credits_used: data.credits_used || 0,
            message: data.message || `Redeemed ${data.contacts_redeemed} contacts via Apollo`
          };
        }

        // Apollo failed - try PDL
        contactsLogger.debug('Apollo redemption failed, trying PDL:', data?.error || error);
      } catch (e) {
        contactsLogger.debug('Apollo redemption error:', e);
      }
    }

    // Try PDL as fallback
    try {
      const { data, error } = await supabase.functions.invoke('redeem-pdl-contacts', {
        body: {
          org_id: userProfile.org_id,
          domains: params.domains,
          icp_criteria: params.icp_criteria,
          persona_filters: params.persona_filters,
          max_contacts: params.max_contacts,
          campaign_name: params.campaign_name
        }
      });

      if (!error && data?.success) {
        return {
          success: true,
          provider: 'pdl',
          contacts_redeemed: data.contacts_redeemed || 0,
          contacts_skipped_duplicate: data.contacts_skipped_duplicate || 0,
          credits_used: data.credits_used || 1,
          message: data.message || `Redeemed ${data.contacts_redeemed} contacts via PDL`
        };
      }

      return {
        success: false,
        provider: 'pdl',
        contacts_redeemed: 0,
        contacts_skipped_duplicate: 0,
        credits_used: 0,
        message: data?.error || 'PDL redemption failed',
        error: data?.error
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'none',
        contacts_redeemed: 0,
        contacts_skipped_duplicate: 0,
        credits_used: 0,
        message: 'No contact providers available',
        error: e.message
      };
    }
  }, [userProfile?.org_id, providerStatus]);

  return {
    providerStatus,
    activeProvider,
    isLoading,
    checkProviders,
    previewContacts,
    redeemContacts
  };
}
