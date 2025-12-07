import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface FeatureFlags {
  icp_manager: boolean;
  icp_tam_intelligence: boolean;
  personas_segments: boolean;
  pipeline_efficiency: boolean;
  capital_efficiency: boolean;
  ai_agents: boolean;
  demo_mode: boolean;
  custom_reports: boolean;
  cohort_analysis: boolean;
  predictive_scoring: boolean;
  advanced_segmentation: boolean;
  trend_analysis: boolean;
}

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  isLoading: boolean;
  updateFlag: (key: keyof FeatureFlags, enabled: boolean) => Promise<void>;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

const defaultFlags: FeatureFlags = {
  // Phase 1 - MVP (Always enabled)
  icp_manager: true,
  icp_tam_intelligence: true,
  // Phase 2-4 (Enabled for GTM)
  personas_segments: true,
  pipeline_efficiency: true,
  capital_efficiency: true,
  ai_agents: true,
  demo_mode: false,
  // Phase 6 - Advanced Analytics (Disabled by default)
  custom_reports: false,
  cohort_analysis: false,
  predictive_scoring: false,
  advanced_segmentation: false,
  trend_analysis: false,
};

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [isLoading, setIsLoading] = useState(true);

  const loadFlags = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      if (!data || data.length === 0) {
        // Initialize default flags for this org
        const { error: initError } = await supabase.rpc('initialize_feature_flags', {
          target_org_id: userProfile.org_id
        });
        
        if (initError) console.error('Error initializing flags:', initError);
        
        // Reload after initialization
        const { data: newData } = await supabase
          .from('feature_flags')
          .select('*')
          .eq('org_id', userProfile.org_id);
        
        if (newData) {
          const flagMap = newData.reduce((acc, flag) => ({
            ...acc,
            [flag.feature_key]: flag.enabled
          }), {} as FeatureFlags);
          setFlags({ ...defaultFlags, ...flagMap });
        }
      } else {
        const flagMap = data.reduce((acc, flag) => ({
          ...acc,
          [flag.feature_key]: flag.enabled
        }), {} as FeatureFlags);
        setFlags({ ...defaultFlags, ...flagMap });
      }
    } catch (error) {
      console.error('Error loading feature flags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFlag = async (key: keyof FeatureFlags, enabled: boolean) => {
    if (!userProfile?.org_id) return;

    try {
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          org_id: userProfile.org_id,
          feature_key: key,
          enabled
        }, {
          onConflict: 'org_id,feature_key'
        });

      if (error) throw error;

      setFlags(prev => ({ ...prev, [key]: enabled }));
    } catch (error) {
      console.error('Error updating feature flag:', error);
      throw error;
    }
  };

  const refreshFlags = async () => {
    setIsLoading(true);
    await loadFlags();
  };

  useEffect(() => {
    loadFlags();
  }, [userProfile?.org_id]);

  return (
    <FeatureFlagsContext.Provider value={{ flags, isLoading, updateFlag, refreshFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
}
