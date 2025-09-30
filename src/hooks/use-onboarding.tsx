import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./use-auth";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  route?: string;
}

interface OnboardingState {
  isComplete: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  showWizard: boolean;
}

interface OnboardingContextType {
  onboarding: OnboardingState;
  completeStep: (stepId: string) => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  startOnboarding: () => void;
  nextStep: () => void;
  previousStep: () => void;
  progress: number;
}

const defaultSteps: OnboardingStep[] = [
  {
    id: "upload_data",
    title: "Upload Your Data",
    description: "Import accounts and contacts from CSV to get started",
    completed: false,
    route: "/data-upload"
  },
  {
    id: "create_icp",
    title: "Define Your ICP",
    description: "Create your first Ideal Customer Profile",
    completed: false,
    route: "/icp-manager"
  },
  {
    id: "view_scores",
    title: "Review Account Scores",
    description: "See how your accounts match your ICP criteria",
    completed: false,
    route: "/accounts"
  },
  {
    id: "explore_dashboard",
    title: "Explore Dashboard",
    description: "View insights and analytics on your TAM intelligence",
    completed: false,
    route: "/executive-dashboard"
  }
];

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    isComplete: false,
    currentStep: 0,
    steps: defaultSteps,
    showWizard: false
  });

  useEffect(() => {
    if (userProfile?.org_id) {
      loadOnboardingState();
    }
  }, [userProfile?.org_id]);

  const loadOnboardingState = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Check if user has data
      const [accountsRes, icpsRes, scoresRes] = await Promise.all([
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('org_id', userProfile.org_id),
        supabase.from('icp_profiles').select('id', { count: 'exact', head: true }).eq('org_id', userProfile.org_id),
        supabase.from('scores').select('id', { count: 'exact', head: true }).eq('org_id', userProfile.org_id)
      ]);

      const hasAccounts = (accountsRes.count || 0) > 0;
      const hasICPs = (icpsRes.count || 0) > 0;
      const hasScores = (scoresRes.count || 0) > 0;

      // Load from localStorage
      const savedState = localStorage.getItem(`onboarding_${userProfile.org_id}`);
      
      if (savedState) {
        const parsed = JSON.parse(savedState);
        setOnboarding(parsed);
      } else {
        // Auto-detect completed steps
        const updatedSteps = [...defaultSteps];
        updatedSteps[0].completed = hasAccounts;
        updatedSteps[1].completed = hasICPs;
        updatedSteps[2].completed = hasScores;
        
        const allComplete = hasAccounts && hasICPs && hasScores;
        const currentStep = updatedSteps.findIndex(s => !s.completed);

        setOnboarding({
          isComplete: allComplete,
          currentStep: currentStep === -1 ? updatedSteps.length - 1 : currentStep,
          steps: updatedSteps,
          showWizard: !allComplete && !savedState
        });
      }
    } catch (error) {
      console.error('Error loading onboarding state:', error);
    }
  };

  const saveState = (state: OnboardingState) => {
    if (userProfile?.org_id) {
      localStorage.setItem(`onboarding_${userProfile.org_id}`, JSON.stringify(state));
    }
  };

  const completeStep = (stepId: string) => {
    setOnboarding(prev => {
      const updatedSteps = prev.steps.map(step =>
        step.id === stepId ? { ...step, completed: true } : step
      );
      
      const allComplete = updatedSteps.every(s => s.completed);
      const currentStep = updatedSteps.findIndex(s => !s.completed);
      
      const newState = {
        ...prev,
        steps: updatedSteps,
        isComplete: allComplete,
        currentStep: currentStep === -1 ? updatedSteps.length - 1 : currentStep,
        showWizard: !allComplete && prev.showWizard
      };
      
      saveState(newState);
      return newState;
    });
  };

  const skipOnboarding = () => {
    setOnboarding(prev => {
      const newState = { ...prev, showWizard: false, isComplete: true };
      saveState(newState);
      return newState;
    });
  };

  const resetOnboarding = () => {
    const newState = {
      isComplete: false,
      currentStep: 0,
      steps: defaultSteps.map(s => ({ ...s, completed: false })),
      showWizard: true
    };
    setOnboarding(newState);
    saveState(newState);
  };

  const startOnboarding = () => {
    setOnboarding(prev => {
      const newState = { ...prev, showWizard: true };
      saveState(newState);
      return newState;
    });
  };

  const nextStep = () => {
    setOnboarding(prev => {
      const newStep = Math.min(prev.currentStep + 1, prev.steps.length - 1);
      const newState = { ...prev, currentStep: newStep };
      saveState(newState);
      return newState;
    });
  };

  const previousStep = () => {
    setOnboarding(prev => {
      const newStep = Math.max(prev.currentStep - 1, 0);
      const newState = { ...prev, currentStep: newStep };
      saveState(newState);
      return newState;
    });
  };

  const progress = Math.round((onboarding.steps.filter(s => s.completed).length / onboarding.steps.length) * 100);

  return (
    <OnboardingContext.Provider value={{
      onboarding,
      completeStep,
      skipOnboarding,
      resetOnboarding,
      startOnboarding,
      nextStep,
      previousStep,
      progress
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
