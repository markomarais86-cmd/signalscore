import { useState, useCallback } from 'react';
import { SEQUENCE_TEMPLATES, SequenceStep, TemplateKey, FuelLineType, FUEL_LINE_TYPES } from '../constants/campaign-config';

export interface FilterCriteria {
  employeeMin?: number;
  employeeMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  marketSegments: string[];
  managementLevels: string[];
  fitScoreMin: number;
  fitScoreMax: number;
}

export interface ICPProfile {
  id: string;
  name: string;
  description?: string;
  industries?: string[];
  geographies?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
  persona_job_titles?: string[];
  persona_seniority_levels?: string[];
  persona_departments?: string[];
}

export interface InsightContext {
  insightTitle?: string;
  suggestedCampaignName?: string;
  targetAccountIds?: string[];
  signalType?: string;
  signalIds?: string[];
  filters?: {
    minScore?: number;
    industries?: string[];
    segments?: string[];
  };
}

export interface CampaignState {
  step: number;
  campaignName: string;
  fuelLineType: FuelLineType;
  useICP: boolean;
  activeICP: ICPProfile | null;
  filterCriteria: FilterCriteria;
  selectedTemplate: TemplateKey;
  sequenceSteps: SequenceStep[];
  selectedTitles: string[];
  selectedSeniority: string[];
  selectedDepartments: string[];
  dataSource: 'all' | 'crm' | 'database';
  provider: 'apollo' | 'zoominfo' | 'clearbit';
  destination: 'salesforce' | 'hubspot' | 'csv' | 'apollo';
  excludeDuplicates: boolean;
}

const initialFilterCriteria: FilterCriteria = {
  marketSegments: [],
  managementLevels: ["VP", "C-Level"],
  fitScoreMin: 70,
  fitScoreMax: 100
};

export function useCampaignState(insightContext?: InsightContext) {
  const [state, setState] = useState<CampaignState>({
    step: 1,
    campaignName: insightContext?.suggestedCampaignName || "",
    fuelLineType: 'firmographic',
    useICP: true,
    activeICP: null,
    filterCriteria: {
      ...initialFilterCriteria,
      fitScoreMin: insightContext?.filters?.minScore || 70
    },
    selectedTemplate: 'enterprise',
    sequenceSteps: SEQUENCE_TEMPLATES.enterprise.steps,
    selectedTitles: [],
    selectedSeniority: [],
    selectedDepartments: [],
    dataSource: 'all',
    provider: 'apollo',
    destination: 'salesforce',
    excludeDuplicates: true
  });

  const setStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const setCampaignName = useCallback((campaignName: string) => {
    setState(prev => ({ ...prev, campaignName }));
  }, []);

  const setFuelLineType = useCallback((fuelLineType: FuelLineType) => {
    const config = FUEL_LINE_TYPES[fuelLineType];
    setState(prev => ({
      ...prev,
      fuelLineType,
      selectedTemplate: config.defaultTemplate,
      sequenceSteps: SEQUENCE_TEMPLATES[config.defaultTemplate].steps,
      filterCriteria: {
        ...prev.filterCriteria,
        managementLevels: config.defaultManagementLevels,
        marketSegments: config.defaultMarketSegments,
      },
      dataSource: config.defaultDataSource,
    }));
  }, []);

  const setUseICP = useCallback((useICP: boolean) => {
    setState(prev => ({ ...prev, useICP }));
  }, []);

  const setActiveICP = useCallback((activeICP: ICPProfile | null) => {
    setState(prev => {
      const newState = { ...prev, activeICP };
      if (activeICP) {
        if (activeICP.persona_job_titles) newState.selectedTitles = activeICP.persona_job_titles;
        if (activeICP.persona_seniority_levels) newState.selectedSeniority = activeICP.persona_seniority_levels;
        if (activeICP.persona_departments) newState.selectedDepartments = activeICP.persona_departments;
      }
      return newState;
    });
  }, []);

  const setFilterCriteria = useCallback((update: Partial<FilterCriteria> | ((prev: FilterCriteria) => FilterCriteria)) => {
    setState(prev => ({
      ...prev,
      filterCriteria: typeof update === 'function' 
        ? update(prev.filterCriteria) 
        : { ...prev.filterCriteria, ...update }
    }));
  }, []);

  const setSelectedTemplate = useCallback((template: TemplateKey) => {
    setState(prev => ({
      ...prev,
      selectedTemplate: template,
      sequenceSteps: SEQUENCE_TEMPLATES[template].steps
    }));
  }, []);

  const setSequenceSteps = useCallback((sequenceSteps: SequenceStep[]) => {
    setState(prev => ({ ...prev, sequenceSteps }));
  }, []);

  const setSelectedTitles = useCallback((selectedTitles: string[]) => {
    setState(prev => ({ ...prev, selectedTitles }));
  }, []);

  const setSelectedSeniority = useCallback((selectedSeniority: string[]) => {
    setState(prev => ({ ...prev, selectedSeniority }));
  }, []);

  const setSelectedDepartments = useCallback((selectedDepartments: string[]) => {
    setState(prev => ({ ...prev, selectedDepartments }));
  }, []);

  const setDataSource = useCallback((dataSource: 'all' | 'crm' | 'database') => {
    setState(prev => ({ ...prev, dataSource }));
  }, []);

  const setProvider = useCallback((provider: 'apollo' | 'zoominfo' | 'clearbit') => {
    setState(prev => ({ ...prev, provider }));
  }, []);

  const setDestination = useCallback((destination: 'salesforce' | 'hubspot' | 'csv' | 'apollo') => {
    setState(prev => ({ ...prev, destination }));
  }, []);

  const setExcludeDuplicates = useCallback((excludeDuplicates: boolean) => {
    setState(prev => ({ ...prev, excludeDuplicates }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, 7) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }));
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 1,
      campaignName: "",
      fuelLineType: 'firmographic',
      useICP: true,
      activeICP: null,
      filterCriteria: initialFilterCriteria,
      selectedTemplate: 'enterprise',
      sequenceSteps: SEQUENCE_TEMPLATES.enterprise.steps,
      selectedTitles: [],
      selectedSeniority: [],
      selectedDepartments: [],
      dataSource: 'all',
      provider: 'apollo',
      destination: 'salesforce',
      excludeDuplicates: true
    });
  }, []);

  return {
    state,
    setStep,
    setCampaignName,
    setFuelLineType,
    setUseICP,
    setActiveICP,
    setFilterCriteria,
    setSelectedTemplate,
    setSequenceSteps,
    setSelectedTitles,
    setSelectedSeniority,
    setSelectedDepartments,
    setDataSource,
    setProvider,
    setDestination,
    setExcludeDuplicates,
    nextStep,
    prevStep,
    reset
  };
}
