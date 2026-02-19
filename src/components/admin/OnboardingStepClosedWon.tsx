import { ClosedWonUpload } from "@/components/data-upload/ClosedWonUpload";

interface OnboardingStepClosedWonProps {
  orgId: string;
  config: any;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}

export function OnboardingStepClosedWon({ orgId }: OnboardingStepClosedWonProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Upload Closed-Won Deals</h3>
        <p className="text-sm text-muted-foreground">
          Upload the customer's closed-won deal history to calibrate ICP recommendations and validate scoring accuracy.
        </p>
      </div>
      <ClosedWonUpload targetOrgId={orgId} />
    </div>
  );
}
