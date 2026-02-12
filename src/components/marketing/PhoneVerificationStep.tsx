import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhoneVerificationStepProps {
  leadId?: string;
  onVerified: (phone: string, result: any) => void;
  onSkip?: () => void;
}

export function PhoneVerificationStep({ leadId, onVerified, onSkip }: PhoneVerificationStepProps) {
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async () => {
    if (!phone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("validate-phone", {
        body: { phone: phone.trim(), lead_id: leadId },
      });

      if (error) throw error;

      setResult(data);

      if (data.valid) {
        toast.success("Phone number verified!");
        onVerified(data.number, data);
      } else {
        toast.error("Invalid phone number. Please check and try again.");
      }
    } catch (err: any) {
      console.error("Phone verification error:", err);
      toast.error("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Verify your phone number</h3>
      <p className="text-sm text-muted-foreground">
        Adding a verified phone number fast-tracks your request to our sales team.
      </p>

      <div className="space-y-2">
        <Label htmlFor="phone-input">Phone Number</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone-input"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-10"
              disabled={verifying || result?.valid}
            />
          </div>
          <Button
            onClick={handleVerify}
            disabled={verifying || !phone.trim() || result?.valid}
            variant={result?.valid ? "outline" : "default"}
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : result?.valid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              "Verify"
            )}
          </Button>
        </div>
      </div>

      {result && !result.valid && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>This number could not be verified. Please check the format.</span>
        </div>
      )}

      {result?.valid && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>
            Verified: {result.number}
            {result.carrier && ` · ${result.carrier}`}
            {result.line_type && ` (${result.line_type})`}
          </span>
        </div>
      )}

      {onSkip && !result?.valid && (
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
