import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Loader2,
  Key,
  Copy,
  HelpCircle,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/friendly-errors";
import { toast } from "sonner";

interface HubSpotSetupWizardProps {
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
  existingConfig?: any;
}

type Step = 1 | 2 | 3;

const REQUIRED_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
];

export function HubSpotSetupWizard({
  orgId,
  onSuccess,
  onCancel,
  existingConfig,
}: HubSpotSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [hasCreatedApp, setHasCreatedApp] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [syncFrequency, setSyncFrequency] = useState(existingConfig?.sync_frequency || "manual");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);
  const [copiedScopes, setCopiedScopes] = useState(false);

  const handleCopyScopes = async () => {
    try {
      await navigator.clipboard.writeText(REQUIRED_SCOPES.join("\n"));
      setCopiedScopes(true);
      toast.success("Scopes copied to clipboard");
      setTimeout(() => setCopiedScopes(false), 2000);
    } catch (error) {
      toast.error("Failed to copy scopes");
    }
  };

  const handleTestConnection = async () => {
    if (!accessToken) {
      setTestResult({ success: false, message: "Please enter your access token" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("integration-service", {
        body: {
          action: "test",
          org_id: orgId,
          provider_name: "hubspot",
          hubspot_credentials: {
            accessToken,
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({ success: true, message: "Connection successful! You can proceed to configure sync settings." });
        setCurrentStep(3);
      } else {
        throw new Error(data?.message || "Connection test failed");
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: toastError(error, "Failed to connect. Check your access token and try again."),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke("integration-service", {
        body: {
          action: "connect",
          org_id: orgId,
          provider_name: "hubspot",
          integration_type: "crm",
          hubspot_credentials: {
            accessToken,
          },
          sync_frequency: syncFrequency,
        },
      });

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      setTestResult({
        success: false,
        message: toastError(error, "Failed to save configuration"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              currentStep >= step
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {currentStep > step ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
          {step < 3 && (
            <div
              className={`w-12 h-0.5 mx-1 ${
                currentStep > step ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {renderStepIndicator()}

      {/* Step 1: Create Private App */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Step 1: Create a HubSpot Private App
            </h3>
            <p className="text-sm text-muted-foreground">
              We use Private Apps for secure, scoped access to your HubSpot data.
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">How to create a Private App:</h4>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0">1</Badge>
                <span>Go to your HubSpot account → Settings → Integrations → Private Apps</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0">2</Badge>
                <span>Click <strong>Create a private app</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0">3</Badge>
                <span>Name your app (e.g., "Your Company Integration")</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0">4</Badge>
                <span>Go to the <strong>Scopes</strong> tab and add the required scopes below</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0">5</Badge>
                <span>Click <strong>Create app</strong> and copy the access token</span>
              </li>
            </ol>

            <a
              href="https://developers.hubspot.com/docs/api/private-apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              HubSpot Private Apps Documentation <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Required Scopes</Label>
              <Button variant="ghost" size="sm" onClick={handleCopyScopes} className="h-8">
                {copiedScopes ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy All
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs space-y-1">
              {REQUIRED_SCOPES.map((scope) => (
                <div key={scope} className="text-muted-foreground">{scope}</div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasCreatedApp}
              onChange={(e) => setHasCreatedApp(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm">I've created my Private App and have the access token</span>
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => setCurrentStep(2)} disabled={!hasCreatedApp}>
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Enter Access Token */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Step 2: Enter Your Access Token
            </h3>
            <p className="text-sm text-muted-foreground">
              Paste the access token from your HubSpot Private App.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setTestResult(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                This token starts with "pat-" and can be found in your Private App settings.
              </p>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border ${
                testResult.success
                  ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                  : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <p className={`text-sm ${testResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          )}

          <Collapsible open={troubleshootingOpen} onOpenChange={setTroubleshootingOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <HelpCircle className="h-4 w-4" />
              Troubleshooting Tips
              {troubleshootingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border p-3 text-sm space-y-2 bg-muted/30">
                <p><strong>Connection fails?</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Make sure you copied the full access token (starts with "pat-")</li>
                  <li>Verify all required scopes are enabled in your Private App</li>
                  <li>Check that your HubSpot account has API access permissions</li>
                  <li>Try generating a new token if the current one isn't working</li>
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-between gap-2 pt-4">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleTestConnection}
                disabled={isTesting || !accessToken}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Configure Sync */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Step 3: Configure Sync Settings
            </h3>
            <p className="text-sm text-muted-foreground">
              Connection verified! Choose how often you want to sync data.
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">HubSpot connection verified successfully!</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Auto-Sync Frequency</Label>
            <select
              className="w-full p-2 border rounded-md bg-background"
              value={syncFrequency}
              onChange={(e) => setSyncFrequency(e.target.value)}
            >
              <option value="manual">Manual only (no auto-sync)</option>
              <option value="hourly">Every hour</option>
              <option value="daily">Daily at 2 AM</option>
              <option value="weekly">Weekly (Monday at 2 AM)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              You can always trigger a manual sync from the integrations page.
            </p>
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save & Connect"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
