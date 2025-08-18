import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Database, Loader2, CheckCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SampleDataResult {
  success: boolean;
  accounts_inserted: number;
  contacts_inserted: number;
  icp_inserted: number;
  scores_inserted: number;
  leads_inserted: number;
  organization_id: string;
}

export function SampleDataGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SampleDataResult | null>(null);
  const { toast } = useToast();

  const generateSampleData = async () => {
    setIsGenerating(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.rpc('generate_sample_data');
      
      if (error) {
        throw error;
      }
      
      if (data) {
        const resultData = data as unknown as SampleDataResult;
        setResult(resultData);
        toast({
          title: "Sample data generated!",
          description: `Created ${resultData.accounts_inserted} accounts, ${resultData.contacts_inserted} contacts, and more.`
        });
        
        // Reload the page after a short delay to show fresh data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Error generating sample data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate sample data",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-dashed border-2 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Get Started with Sample Data</CardTitle>
        <CardDescription>
          Generate sample accounts, contacts, and ICP profiles to explore the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This will create sample companies like TechCorp Solutions, DataFlow Industries, 
            and others with realistic contact information and scoring data.
          </AlertDescription>
        </Alert>

        {!result && (
          <Button 
            onClick={generateSampleData} 
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Sample Data...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Generate Sample Data
              </>
            )}
          </Button>
        )}

        {result && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Sample data generated successfully! The page will refresh shortly to show your data.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{result.accounts_inserted}</div>
                <div className="text-sm text-muted-foreground">Accounts</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{result.contacts_inserted}</div>
                <div className="text-sm text-muted-foreground">Contacts</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{result.icp_inserted}</div>
                <div className="text-sm text-muted-foreground">ICP Profiles</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{result.scores_inserted}</div>
                <div className="text-sm text-muted-foreground">Scores</div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary">Enterprise Technology Focus</Badge>
              <Badge variant="secondary">Global Companies</Badge>
              <Badge variant="secondary">C-Level Contacts</Badge>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          You can always upload your own data via the Data Upload page or create custom ICP profiles.
        </div>
      </CardContent>
    </Card>
  );
}