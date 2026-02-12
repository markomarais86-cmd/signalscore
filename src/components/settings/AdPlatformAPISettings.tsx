import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink, TestTube, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PlatformSection {
  name: string;
  description: string;
  docsUrl: string;
  docsLabel: string;
  credentials: { key: string; label: string; description: string }[];
}

const platforms: PlatformSection[] = [
  {
    name: "Google Analytics 4",
    description: "Send server-side events via GA4 Measurement Protocol",
    docsUrl: "https://analytics.google.com/analytics/web/#/admin",
    docsLabel: "GA4 Admin → Data Streams → Measurement Protocol API secrets",
    credentials: [
      { key: "GA4_MEASUREMENT_ID", label: "Measurement ID", description: "Format: G-XXXXXXXXXX. Found in Admin → Data Streams." },
      { key: "GA4_API_SECRET", label: "API Secret", description: "Create in Admin → Data Streams → Measurement Protocol API secrets." },
    ],
  },
  {
    name: "Meta (Facebook)",
    description: "Send conversion events via Meta Conversions API (CAPI)",
    docsUrl: "https://business.facebook.com/events_manager",
    docsLabel: "Meta Events Manager → Settings → Conversions API",
    credentials: [
      { key: "META_PIXEL_ID", label: "Pixel ID", description: "Found in Events Manager → Data Sources." },
      { key: "META_CAPI_TOKEN", label: "CAPI Access Token", description: "Generate in Events Manager → Settings → Conversions API." },
    ],
  },
  {
    name: "LinkedIn",
    description: "Send conversion events via LinkedIn Conversions API",
    docsUrl: "https://www.linkedin.com/campaignmanager",
    docsLabel: "LinkedIn Campaign Manager → Account Assets → Conversions",
    credentials: [
      { key: "LINKEDIN_CAPI_TOKEN", label: "CAPI Token", description: "Generate via LinkedIn Developer Portal OAuth flow." },
      { key: "LINKEDIN_AD_ACCOUNT_ID", label: "Ad Account ID", description: "Found in Campaign Manager URL (e.g., 508123456)." },
    ],
  },
];

export function AdPlatformAPISettings() {
  const { toast } = useToast();
  const [testing, setTesting] = useState<string | null>(null);

  const handleTestConnection = async (platformName: string) => {
    setTesting(platformName);
    try {
      const { data, error } = await supabase.functions.invoke("push-conversion-event", {
        body: {
          event_name: "TestEvent",
          lead_id: "test-000",
          email: "test@example.com",
          org_id: "test",
        },
      });

      if (error) throw error;

      toast({
        title: "Test sent",
        description: `${platformName} test event dispatched. Check platform dashboard for delivery.`,
      });
    } catch (err: any) {
      toast({
        title: "Test failed",
        description: err.message || "Could not send test event",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ad Platform Conversion Tracking
        </CardTitle>
        <CardDescription>
          Configure server-side conversion events for GA4, Meta CAPI, and LinkedIn CAPI.
          Secrets are managed in your Supabase project's Edge Function secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map((platform) => (
          <Collapsible key={platform.name}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="text-left">
                <p className="font-medium">{platform.name}</p>
                <p className="text-sm text-muted-foreground">{platform.description}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3 pt-2 space-y-3">
              <div className="space-y-2">
                {platform.credentials.map((cred) => (
                  <div key={cred.key} className="flex items-start justify-between p-2 rounded bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{cred.label}</p>
                      <p className="text-xs text-muted-foreground">{cred.description}</p>
                      <code className="text-xs text-muted-foreground">{cred.key}</code>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      Supabase Secret
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={platform.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {platform.docsLabel}
                </a>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection(platform.name)}
                disabled={testing !== null}
              >
                <TestTube className="h-3.5 w-3.5 mr-1.5" />
                {testing === platform.name ? "Sending…" : "Test Connection"}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        ))}

        <p className="text-xs text-muted-foreground pt-2">
          Add secrets in{" "}
          <a
            href="https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Supabase → Settings → Edge Functions → Secrets
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

export default AdPlatformAPISettings;
