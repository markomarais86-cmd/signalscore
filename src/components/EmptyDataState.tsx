import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, Upload, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmptyDataStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionRoute?: string;
  showUploadPrompt?: boolean;
}

export function EmptyDataState({ 
  title, 
  description, 
  actionLabel = "Upload Data",
  actionRoute = "/data-upload",
  showUploadPrompt = true 
}: EmptyDataStateProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-muted">
            <Database className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-md mx-auto">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUploadPrompt && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Start by uploading your CRM data (accounts and contacts) to see insights and analytics.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex justify-center">
          <Button onClick={() => navigate(actionRoute)}>
            <Upload className="h-4 w-4 mr-2" />
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
