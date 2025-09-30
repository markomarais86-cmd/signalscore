import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Save, Check, ArrowLeft } from 'lucide-react';
import { ICPFormData, ICPTemplate } from '@/types/icp';
import { ICPTemplateSelector } from './ICPTemplateSelector';
import { ICPWizardStep1 } from './ICPWizardStep1';
import { ICPWizardStep2 } from './ICPWizardStep2';
import { ICPWizardStep3 } from './ICPWizardStep3';
import { ICPWizardStep4 } from './ICPWizardStep4';
import { ICPWizardStep5 } from './ICPWizardStep5';
import { ClosedWonInsights } from './ClosedWonInsights';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface ICPWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  editingICP?: any; // Existing ICP for editing
}

const initialFormData: ICPFormData = {
  name: '',
  description: '',
  use_case: '',
  
  // Basic targeting
  industries: [],
  sub_industries: [],
  company_sizes: [],
  revenue_ranges: [],
  geographies: [],
  
  // Persona targeting
  persona_job_titles: [],
  persona_seniority_levels: [],
  persona_departments: [],
  persona_decision_roles: [],
  
  // Company classification
  company_stages: [],
  tech_stack: [],
  growth_stage: [],
  funding_status: [],
  
  // Advanced geographic
  regions: [],
  cities: [],
  timezones: [],
  
  // Intent and signals
  intent_signals: [],
  buying_triggers: [],
  
  // Exclusions
  excluded_companies: [],
  excluded_industries: [],
  
  // Patterns and budget
  seasonal_patterns: [],
  budget_indicators: [],
  
  // Metadata
  tags: [],
  status: 'draft'
};

const STEP_TITLES = [
  'Choose Template',
  'Basic Information',
  'Company Targeting',
  'Persona Targeting',
  'Advanced Targeting',
  'Validation & Preview'
];

export function ICPWizard({ isOpen, onClose, onComplete, editingICP }: ICPWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ICPFormData>(initialFormData);
  const [selectedTemplate, setSelectedTemplate] = useState<ICPTemplate | null>(null);
  const [showClosedWonFlow, setShowClosedWonFlow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (editingICP && isOpen) {
      // If editing, populate form with existing data and skip template selection
      setFormData({
        name: editingICP.name || '',
        description: editingICP.description || '',
        use_case: editingICP.use_case || '',
        
        industries: editingICP.industries || [],
        sub_industries: editingICP.sub_industries || [],
        company_sizes: editingICP.company_sizes || [],
        revenue_ranges: editingICP.revenue_ranges || [],
        geographies: editingICP.geographies || [],
        
        persona_job_titles: editingICP.persona_job_titles || [],
        persona_seniority_levels: editingICP.persona_seniority_levels || [],
        persona_departments: editingICP.persona_departments || [],
        persona_decision_roles: editingICP.persona_decision_roles || [],
        
        company_stages: editingICP.company_stages || [],
        tech_stack: editingICP.tech_stack || [],
        growth_stage: editingICP.growth_stage || [],
        funding_status: editingICP.funding_status || [],
        
        regions: editingICP.regions || [],
        cities: editingICP.cities || [],
        timezones: editingICP.timezones || [],
        
        intent_signals: editingICP.intent_signals || [],
        buying_triggers: editingICP.buying_triggers || [],
        
        excluded_companies: editingICP.excluded_companies || [],
        excluded_industries: editingICP.excluded_industries || [],
        
        seasonal_patterns: editingICP.seasonal_patterns || [],
        budget_indicators: editingICP.budget_indicators || [],
        
        tags: editingICP.tags || [],
        status: editingICP.status || 'draft'
      });
      setCurrentStep(1); // Skip template selection when editing
    } else if (isOpen) {
      // Reset for new ICP creation
      setFormData(initialFormData);
      setSelectedTemplate(null);
      setShowClosedWonFlow(false);
      setCurrentStep(0);
    }
  }, [editingICP, isOpen]);

  const updateFormData = (updates: Partial<ICPFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleTemplateSelection = (template: ICPTemplate, templateFormData: ICPFormData) => {
    setSelectedTemplate(template);
    setFormData({ 
      ...templateFormData, 
      name: `${template.name} - Copy`,
      template_source: template.name 
    });
    setCurrentStep(1);
  };

  const handleSkipTemplate = () => {
    setSelectedTemplate(null);
    setFormData(initialFormData);
    setShowClosedWonFlow(false);
    setCurrentStep(1);
  };

  const handleSelectClosedWon = () => {
    setShowClosedWonFlow(true);
    setSelectedTemplate(null);
    setCurrentStep(0); // Stay on step 0 to show ClosedWonInsights
  };

  const handleBackFromClosedWon = () => {
    setShowClosedWonFlow(false);
    setCurrentStep(0);
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'ICP name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEP_TITLES.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, editingICP ? 1 : 0));
  };

  const handleSave = async () => {
    if (!validateCurrentStep() || !userProfile?.org_id) return;

    setIsSaving(true);
    try {
      const icpData = {
        org_id: userProfile.org_id,
        name: formData.name,
        description: formData.description || null,
        use_case: formData.use_case || null,
        
        // Arrays
        industries: formData.industries.length > 0 ? formData.industries : null,
        sub_industries: formData.sub_industries.length > 0 ? formData.sub_industries : null,
        company_sizes: formData.company_sizes.length > 0 ? formData.company_sizes : null,
        revenue_ranges: formData.revenue_ranges.length > 0 ? formData.revenue_ranges : null,
        geographies: formData.geographies.length > 0 ? formData.geographies : null,
        
        persona_job_titles: formData.persona_job_titles.length > 0 ? formData.persona_job_titles : null,
        persona_seniority_levels: formData.persona_seniority_levels.length > 0 ? formData.persona_seniority_levels : null,
        persona_departments: formData.persona_departments.length > 0 ? formData.persona_departments : null,
        persona_decision_roles: formData.persona_decision_roles.length > 0 ? formData.persona_decision_roles : null,
        
        company_stages: formData.company_stages.length > 0 ? formData.company_stages : null,
        tech_stack: formData.tech_stack.length > 0 ? formData.tech_stack : null,
        growth_stage: formData.growth_stage.length > 0 ? formData.growth_stage : null,
        funding_status: formData.funding_status.length > 0 ? formData.funding_status : null,
        
        regions: formData.regions.length > 0 ? formData.regions : null,
        cities: formData.cities.length > 0 ? formData.cities : null,
        timezones: formData.timezones.length > 0 ? formData.timezones : null,
        
        intent_signals: formData.intent_signals.length > 0 ? formData.intent_signals : null,
        buying_triggers: formData.buying_triggers.length > 0 ? formData.buying_triggers : null,
        
        excluded_companies: formData.excluded_companies.length > 0 ? formData.excluded_companies : null,
        excluded_industries: formData.excluded_industries.length > 0 ? formData.excluded_industries : null,
        
        seasonal_patterns: formData.seasonal_patterns.length > 0 ? formData.seasonal_patterns : null,
        budget_indicators: formData.budget_indicators.length > 0 ? formData.budget_indicators : null,
        
        tags: formData.tags.length > 0 ? formData.tags : null,
        template_source: selectedTemplate?.name || null,
        status: formData.status,
        version: editingICP ? (editingICP.version || 1) + 1 : 1
      };

      if (editingICP) {
        const { error } = await supabase
          .from('icp_profiles')
          .update(icpData)
          .eq('id', editingICP.id);

        if (error) throw error;
        toast({ title: "Success", description: "ICP profile updated successfully" });
      } else {
        const { error } = await supabase
          .from('icp_profiles')
          .insert(icpData);

        if (error) throw error;
        toast({ title: "Success", description: "ICP profile created successfully" });
      }

      onComplete();
      onClose();
    } catch (error) {
      console.error('Error saving ICP:', error);
      toast({
        title: "Error",
        description: "Failed to save ICP profile",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderCurrentStep = () => {
    // Show ClosedWonInsights if in that flow
    if (showClosedWonFlow) {
      return (
        <ClosedWonInsights 
          onCreateICP={(recommendation) => {
            onComplete();
            onClose();
          }} 
        />
      );
    }

    switch (currentStep) {
      case 0:
        return (
          <ICPTemplateSelector 
            onSelectTemplate={handleTemplateSelection}
            onSkip={handleSkipTemplate}
            onSelectClosedWon={handleSelectClosedWon}
          />
        );
      case 1:
        return (
          <ICPWizardStep1 
            formData={formData} 
            onUpdateFormData={updateFormData}
            errors={errors}
          />
        );
      case 2:
        return (
          <ICPWizardStep2 
            formData={formData} 
            onUpdateFormData={updateFormData}
          />
        );
      case 3:
        return (
          <ICPWizardStep3 
            formData={formData} 
            onUpdateFormData={updateFormData}
          />
        );
      case 4:
        return (
          <ICPWizardStep4 
            formData={formData} 
            onUpdateFormData={updateFormData}
          />
        );
      case 5:
        return (
          <ICPWizardStep5 
            formData={formData}
          />
        );
      default:
        return null;
    }
  };

  const getProgress = () => {
    const totalSteps = editingICP ? STEP_TITLES.length - 1 : STEP_TITLES.length;
    const currentProgress = editingICP && currentStep === 0 ? 1 : currentStep;
    return (currentProgress / (totalSteps - 1)) * 100;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to ICP Manager
                </Button>
                <div className="h-6 border-l border-border"></div>
                <div>
                  <h1 className="text-xl font-semibold">
                    {editingICP ? 'Edit ICP Profile' : showClosedWonFlow ? 'Create ICP from Wins' : 'Create ICP Profile'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {showClosedWonFlow ? 'AI-generated ICP based on closed won deals' : STEP_TITLES[currentStep]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!showClosedWonFlow && (
                  <>
                    <div className="text-sm text-muted-foreground">
                      Step {currentStep + (editingICP ? 0 : 1)} of {STEP_TITLES.length - (editingICP ? 1 : 0)}
                    </div>
                    <Progress value={getProgress()} className="w-32" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-8">
              {renderCurrentStep()}
            </CardContent>
          </Card>

          {/* Navigation */}
          {currentStep > 0 && !showClosedWonFlow && (
            <div className="flex justify-between items-center mt-8">
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                disabled={currentStep <= (editingICP ? 1 : 0)}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex gap-2">
                {currentStep < STEP_TITLES.length - 1 ? (
                  <Button 
                    onClick={handleNext}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2"
                  >
                    {isSaving ? (
                      'Saving...'
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {editingICP ? 'Update ICP' : 'Create ICP'}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}