import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { DollarSign, AlertCircle, Target } from "lucide-react";
import { ICPProfile } from "../hooks/useCampaignState";

interface SetupStepProps {
  campaignName: string;
  setCampaignName: (name: string) => void;
  useICP: boolean;
  setUseICP: (use: boolean) => void;
  activeICP: ICPProfile | null;
  aiGeneratedNames: string[];
  isGeneratingNames: boolean;
  onGenerateNames: () => void;
}

export function SetupStep({
  campaignName,
  setCampaignName,
  useICP,
  setUseICP,
  activeICP,
  aiGeneratedNames,
  isGeneratingNames,
  onGenerateNames
}: SetupStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={onGenerateNames}
            disabled={isGeneratingNames}
            className="gap-2"
          >
            <LaunchPulseMark className="h-3 w-3" />
            {isGeneratingNames ? "Generating..." : "AI Generate"}
          </Button>
        </div>
        <Input
          id="campaign-name"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Q1 Enterprise Outreach"
          className="mt-2"
        />
        {aiGeneratedNames.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">AI Suggestions:</p>
            <div className="flex flex-wrap gap-2">
              {aiGeneratedNames.map((name, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setCampaignName(name)}
                >
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="use-icp"
            checked={useICP}
            onCheckedChange={(checked) => setUseICP(checked === true)}
            disabled={!activeICP}
          />
          <Label htmlFor="use-icp" className="flex items-center gap-2">
            Use Ideal Customer Profile (ICP)
            {!activeICP && <span className="text-muted-foreground ml-2">(No ICP configured)</span>}
            <span className="text-xs text-muted-foreground">
              (Pre-filters accounts by your ICP scoring criteria)
            </span>
          </Label>
        </div>
        
        <Alert className="bg-primary/5 border-primary/20">
          <DollarSign className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-1">Estimated Cost Preview</div>
            <div className="text-sm">
              • CRM Source: <strong>$0</strong> (use existing contacts, no enrichment needed)
            </div>
            <div className="text-sm">
              • Database Source: <strong>~$0.015-$0.03/contact</strong> via unified enrichment waterfall
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Costs vary based on data availability. See Data Source step for detailed breakdown.
            </div>
          </AlertDescription>
        </Alert>
      </div>
      
      {useICP && !activeICP && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No ICP profile found. Please create an ICP first or uncheck "Use ICP" to target all accounts.
          </AlertDescription>
        </Alert>
      )}
      
      {activeICP && useICP && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>ICP Context</CardTitle>
            <CardDescription>{activeICP.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">Industries:</span>
              <span className="text-sm text-muted-foreground ml-2">
                {activeICP.industries?.join(', ') || 'All'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeICP.industries?.map(ind => <Badge key={ind} variant="secondary">{ind}</Badge>)}
              {activeICP.geographies?.map(geo => <Badge key={geo} variant="outline">{geo}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
      
      {!useICP && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            Will target all available accounts. You can refine criteria in the next step.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
