import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Rocket, Target, ArrowRight } from 'lucide-react';

export default function Discovery() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">LaunchPulse Discovery</h1>
          <p className="text-muted-foreground">
            Discover companies matching your ICP and add them to your pipeline
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Start with an ICP
          </CardTitle>
          <CardDescription>
            LaunchPulse Discovery is now integrated into the ICP Manager. 
            Select an ICP to discover companies matching your ideal customer profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Discovery is ICP-Powered</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Go to ICP Manager to create or select an ICP, then use the "Discover Companies" 
              button to find new accounts matching your criteria.
            </p>
            <Button onClick={() => navigate('/icp-manager')} className="flex items-center gap-2">
              Go to ICP Manager
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
