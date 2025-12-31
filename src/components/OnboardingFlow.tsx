import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Upload, 
  Target, 
  Database, 
  BarChart3, 
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LaunchPulseMark } from '@/components/BrandLogo';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  completed: boolean;
  optional?: boolean;
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'upload-data',
      title: 'Upload Your CRM Data',
      description: 'Import your accounts and contacts from CSV files to get started with LaunchPulse.',
      icon: <Upload className="h-6 w-6" />,
      path: '/data-upload',
      completed: false
    },
    {
      id: 'create-icp',
      title: 'Define Your ICP',
      description: 'Create your first Ideal Customer Profile to match against your CRM data.',
      icon: <Target className="h-6 w-6" />,
      path: '/icp-manager',
      completed: false
    },
    {
      id: 'view-analysis',
      title: 'Review ICP Analysis',
      description: 'See how well your CRM data matches your ICP and get actionable insights.',
      icon: <BarChart3 className="h-6 w-6" />,
      path: '/icp-analysis',
      completed: false
    },
    {
      id: 'explore-dashboard',
      title: 'Explore Dashboard Features',
      description: 'Get familiar with the main dashboard and key metrics.',
      icon: <Database className="h-6 w-6" />,
      path: '/dashboard',
      completed: false,
      optional: true
    }
  ]);

  const progress = (steps.filter(s => s.completed).length / steps.length) * 100;
  const currentStepData = steps[currentStep];

  const markStepCompleted = (stepId: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed: true } : step
    ));
  };

  const handleStepAction = () => {
    if (currentStepData) {
      navigate(currentStepData.path);
      markStepCompleted(currentStepData.id);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    onComplete();
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 mb-4">
          <LaunchPulseMark className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Welcome to LaunchPulse</h1>
        </div>
        <p className="text-muted-foreground">
          Let's get you set up with your ICP analysis in just a few steps
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-sm text-muted-foreground">Progress:</span>
          <Progress value={progress} className="w-32" />
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Current Step */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {currentStepData?.icon}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentStepData?.title}
                  {currentStepData?.optional && (
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
            {currentStepData?.completed && (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {currentStepData?.description}
          </p>
          
          <div className="flex items-center gap-3">
            <Button onClick={handleStepAction} className="flex-1">
              {currentStepData?.completed ? 'Visit Again' : 'Get Started'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            {currentStepData?.optional && (
              <Button variant="outline" onClick={nextStep}>
                Skip
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* All Steps Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  index === currentStep 
                    ? 'border-primary bg-primary/5' 
                    : step.completed
                    ? 'border-green-200 bg-green-50'
                    : 'border-muted'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  step.completed 
                    ? 'bg-green-100 text-green-600'
                    : index === currentStep
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{step.title}</h3>
                    {step.optional && (
                      <Badge variant="outline" className="text-xs">Optional</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {step.completed && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={prevStep}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={skipOnboarding}>
            Skip Setup
          </Button>
          <Button onClick={nextStep}>
            {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next Step'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingFlow;