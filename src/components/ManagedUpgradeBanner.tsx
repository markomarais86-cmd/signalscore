import { useState } from "react";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const DISMISS_KEY = "managed-upgrade-banner-dismissed";

export function ManagedUpgradeBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "true"
  );

  if (dismissed) return null;

  return (
    <div className="relative rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Your account is managed by LaunchPulse
          </p>
          <p className="text-xs text-muted-foreground">
            Upgrade to self-service for full platform access — build ICPs, upload data, and run scoring yourself.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => navigate("/upgrade")}>
          Upgrade
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
