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
  User,
  Lock,
  Globe,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/friendly-errors";

interface SalesforceSetupWizardProps {
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
  existingConfig?: any;
}

type Step = 1 | 2 | 3;

export function SalesforceSetupWizard({
  orgId,
  onSuccess,
  onCancel,
  existingConfig,
}: SalesforceSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [hasToken, setHasToken] = useState(false);
  const [credentials, setCredentials] = useState({
    instanceUrl: existingConfig?.instanceUrl || "",
    username: existingConfig?.username || "",
    password: "",
    securityToken: "",
  });
  const [syncFrequency, setSyncFrequency] = useState(existingConfig?.sync_frequency || "manual");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);

  const handleTestConnection = async () => {
    if (!credentials.instanceUrl || !credentials.username || !credentials.password || !credentials.securityToken) {
      setTestResult({ success: false, message: "Please fill in all required fields" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("integration-service", {
        body: {
          action: "test",
          org_id: orgId,
          provider_name: "salesforce",
          salesforce_credentials: {
            username: credentials.username,
            password: credentials.password,
            securityToken: credentials.securityToken,
            instanceUrl: credentials.instanceUrl,
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
        message: toastError(error, "Failed to connect. Check your credentials and try again."),
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
          provider_name: "salesforce",
          integration_type: "crm",
          salesforce_credentials: {
            username: credentials.username,
            password: credentials.password,
            securityToken: credentials.securityToken,
            instanceUrl: credentials.instanceUrl,
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

      {/* Step 1: Get Security Token */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Step 1: Get Your Security Token
            </h3>
            <p className="text-sm text-muted-foreground">
              Salesforce requires a security token to connect via API. Follow these steps to get yours.
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">How to get your Security Token:</h4>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">1</Badge>
                <span>Log into your Salesforce account</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">2</Badge>
                <span>Click your profile icon → <strong>Settings</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">3</Badge>
                <span>In the left sidebar, go to <strong>My Personal Information</strong> → <strong>Reset My Security Token</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">4</Badge>
                <span>Click <strong>Reset Security Token</strong> button</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">5</Badge>
                <span>Check your email for the new token</span>
              </li>
            </ol>

            <a
              href="https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
            >
              Salesforce Help Documentation <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasToken}
              onChange={(e) => setHasToken(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm">I have my security token ready</span>
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => setCurrentStep(2)} disabled={!hasToken}>
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Enter Credentials */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Step 2: Enter Your Credentials
            </h3>
            <p className="text-sm text-muted-foreground">
              Enter your Salesforce login details and security token.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instanceUrl" className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                Instance URL
              </Label>
              <Input
                id="instanceUrl"
                placeholder="https://yourcompany.salesforce.com"
                value={credentials.instanceUrl}
                onChange={(e) => {
                  setCredentials({ ...credentials, instanceUrl: e.target.value });
                  setTestResult(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Your Salesforce domain (e.g., na1.salesforce.com or mycompany.my.salesforce.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Username
              </Label>
              <Input
                id="username"
                placeholder="user@company.com"
                value={credentials.username}
                onChange={(e) => {
                  setCredentials({ ...credentials, username: e.target.value });
                  setTestResult(null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your Salesforce password"
                value={credentials.password}
                onChange={(e) => {
                  setCredentials({ ...credentials, password: e.target.value });
                  setTestResult(null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="securityToken" className="flex items-center gap-1">
                <Key className="h-4 w-4" />
                Security Token
              </Label>
              <Input
                id="securityToken"
                type="password"
                placeholder="Your security token from email"
                value={credentials.securityToken}
                onChange={(e) => {
                  setCredentials({ ...credentials, securityToken: e.target.value });
                  setTestResult(null);
                }}
              />
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
                  <li>Make sure your password doesn't include the security token (enter them separately)</li>
                  <li>Check that your user has API access enabled in Salesforce</li>
                  <li>If your org uses SSO, you may need a Salesforce-specific password</li>
                  <li>Reset your security token if it was recently changed</li>
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
                disabled={isTesting || !credentials.instanceUrl || !credentials.username || !credentials.password || !credentials.securityToken}
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
              <span className="font-medium">Salesforce connection verified successfully!</span>
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
