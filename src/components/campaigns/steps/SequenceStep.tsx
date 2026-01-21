import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { SEQUENCE_TEMPLATES, TemplateKey, SequenceStep as SequenceStepType } from "../constants/campaign-config";

interface SequenceStepProps {
  selectedTemplate: TemplateKey;
  onTemplateChange: (template: TemplateKey) => void;
  sequenceRecommendations: any;
  isOptimizingSequence: boolean;
  onOptimizeSequence: () => void;
}

export function SequenceStep({
  selectedTemplate,
  onTemplateChange,
  sequenceRecommendations,
  isOptimizingSequence,
  onOptimizeSequence
}: SequenceStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold mb-2">Define Go-to-Market Sequence</h3>
          <p className="text-sm text-muted-foreground">Choose a template or customize your outreach cadence</p>
        </div>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={onOptimizeSequence}
          disabled={isOptimizingSequence}
          className="gap-2"
        >
          <LaunchPulseMark className="h-3 w-3" />
          {isOptimizingSequence ? "Optimizing..." : "AI Optimize"}
        </Button>
      </div>

      {sequenceRecommendations && (
        <Alert className="bg-primary/5 border-primary/20">
          <LaunchPulseMark className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">
              AI Recommendation: {sequenceRecommendations.recommendedTemplate.toUpperCase()}
            </div>
            <p className="text-xs">{sequenceRecommendations.reasoning}</p>
            {sequenceRecommendations.personalizationTips && (
              <ul className="mt-2 text-xs space-y-1">
                {sequenceRecommendations.personalizationTips.map((tip: string, idx: number) => (
                  <li key={idx}>• {tip}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={selectedTemplate} onValueChange={(v) => onTemplateChange(v as TemplateKey)}>
        <TabsList className="grid w-full grid-cols-3">
          {Object.keys(SEQUENCE_TEMPLATES).map(templateKey => (
            <TabsTrigger key={templateKey} value={templateKey}>
              {SEQUENCE_TEMPLATES[templateKey as TemplateKey].name}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(SEQUENCE_TEMPLATES).map(templateKey => (
          <TabsContent key={templateKey} value={templateKey} className="mt-4">
            <div className="space-y-3">
              {SEQUENCE_TEMPLATES[templateKey as TemplateKey].steps.map((step, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4 flex items-start gap-3">
                    <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold">D{step.day}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{step.action}</div>
                      <div className="text-sm text-muted-foreground">{step.description}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
