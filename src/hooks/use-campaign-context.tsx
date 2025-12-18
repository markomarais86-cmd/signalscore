import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface CampaignInsightContext {
  insightTitle?: string;
  suggestedCampaignName?: string;
  targetAccountIds?: string[];
  filters?: {
    minScore?: number;
    industries?: string[];
    segments?: string[];
    source?: 'insight' | 'enrichment' | 'scoring';
  };
}

interface CampaignContextValue {
  insightContext: CampaignInsightContext | null;
  setCampaignFromInsight: (context: CampaignInsightContext) => void;
  clearCampaignContext: () => void;
  isCampaignBuilderOpen: boolean;
  openCampaignBuilder: (context?: CampaignInsightContext) => void;
  closeCampaignBuilder: () => void;
}

const CampaignContext = createContext<CampaignContextValue | undefined>(undefined);

export function CampaignContextProvider({ children }: { children: ReactNode }) {
  const [insightContext, setInsightContext] = useState<CampaignInsightContext | null>(null);
  const [isCampaignBuilderOpen, setIsCampaignBuilderOpen] = useState(false);

  const setCampaignFromInsight = useCallback((context: CampaignInsightContext) => {
    setInsightContext(context);
  }, []);

  const clearCampaignContext = useCallback(() => {
    setInsightContext(null);
  }, []);

  const openCampaignBuilder = useCallback((context?: CampaignInsightContext) => {
    if (context) {
      setInsightContext(context);
    }
    setIsCampaignBuilderOpen(true);
  }, []);

  const closeCampaignBuilder = useCallback(() => {
    setIsCampaignBuilderOpen(false);
    // Clear context after a delay to allow for animation
    setTimeout(() => setInsightContext(null), 300);
  }, []);

  return (
    <CampaignContext.Provider 
      value={{ 
        insightContext, 
        setCampaignFromInsight, 
        clearCampaignContext,
        isCampaignBuilderOpen,
        openCampaignBuilder,
        closeCampaignBuilder
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaignContext() {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaignContext must be used within a CampaignContextProvider');
  }
  return context;
}
