import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Target, Zap } from "lucide-react";
import { ApolloCreditsDisplay } from "../ApolloCreditsDisplay";
import { formatNumber } from "@/utils/format-numbers";

interface ExportStepProps {
  destination: 'salesforce' | 'hubspot' | 'csv' | 'apollo';
  setDestination: (dest: 'salesforce' | 'hubspot' | 'csv' | 'apollo') => void;
  estimatedLeads: number;
  previewData: any[] | null;
  apolloTamData: any;
  apolloTamDomains: string[];
  dataSource: 'all' | 'crm' | 'database';
  crmSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  isPushing: boolean;
  pushComplete: boolean;
  onCreateCampaign: () => void;
  onOpenApolloRedemption: () => void;
  onClose: () => void;
}

export function ExportStep({
  destination,
  setDestination,
  estimatedLeads,
  previewData,
  apolloTamData,
  apolloTamDomains,
  dataSource,
  crmSyncStatus,
  isPushing,
  pushComplete,
  onCreateCampaign,
  onOpenApolloRedemption,
  onClose
}: ExportStepProps) {
  if (pushComplete) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Campaign Created Successfully!</h3>
        <p className="text-muted-foreground">
          {destination === 'salesforce' && `${formatNumber(estimatedLeads)} leads pushed to Salesforce`}
          {destination === 'hubspot' && `${formatNumber(estimatedLeads)} contacts pushed to HubSpot`}
          {destination === 'csv' && `${formatNumber(estimatedLeads)} leads exported as CSV`}
          {destination === 'apollo' && `Contacts redeemed from Apollo`}
        </p>
        <Button onClick={onClose} className="mt-6">Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Select Destination</h3>
        <p className="text-sm text-muted-foreground">Where would you like to send your campaign contacts?</p>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all ${destination === 'salesforce' ? 'border-primary ring-2 ring-primary' : ''}`}
          onClick={() => setDestination('salesforce')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Salesforce</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Create leads in Salesforce CRM</p>
            {destination === 'salesforce' && (
              <div className="mt-3 pt-3 border-t text-xs space-y-1">
                <div className="flex justify-between"><span>Email →</span><span className="text-muted-foreground">Lead.Email</span></div>
                <div className="flex justify-between"><span>Company →</span><span className="text-muted-foreground">Lead.Company</span></div>
                <div className="flex justify-between"><span>Title →</span><span className="text-muted-foreground">Lead.Title</span></div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card
          className={`cursor-pointer transition-all ${destination === 'hubspot' ? 'border-primary ring-2 ring-primary' : ''}`}
          onClick={() => setDestination('hubspot')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">HubSpot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Create contacts in HubSpot CRM</p>
            {destination === 'hubspot' && (
              <div className="mt-3 pt-3 border-t text-xs space-y-1">
                <div className="flex justify-between"><span>Email →</span><span className="text-muted-foreground">email</span></div>
                <div className="flex justify-between"><span>Company →</span><span className="text-muted-foreground">company</span></div>
                <div className="flex justify-between"><span>Title →</span><span className="text-muted-foreground">jobtitle</span></div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card
          className={`cursor-pointer transition-all ${destination === 'csv' ? 'border-primary ring-2 ring-primary' : ''}`}
          onClick={() => setDestination('csv')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Export CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Download file for manual import</p>
            {destination === 'csv' && (
              <div className="mt-3 pt-3 border-t text-xs">
                <span className="text-muted-foreground">20 fields including scores, firmographics, and contact intel</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card
          className={`cursor-pointer transition-all ${destination === 'apollo' ? 'border-primary ring-2 ring-primary' : 'border-amber-500/50'}`}
          onClick={() => setDestination('apollo')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Apollo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Redeem contacts from Apollo (uses credits)</p>
            {destination === 'apollo' && (
              <div className="mt-3 pt-3 border-t text-xs">
                <ApolloCreditsDisplay compact />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* CRM Sync Status */}
      {(destination === 'salesforce' || destination === 'hubspot') && (
        <Alert className="bg-muted/50">
          <Target className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {estimatedLeads} contacts will be created in {destination === 'salesforce' ? 'Salesforce' : 'HubSpot'}
            </span>
            <Badge variant="outline" className="ml-2">
              {crmSyncStatus === 'idle' && 'Ready to sync'}
              {crmSyncStatus === 'syncing' && 'Syncing...'}
              {crmSyncStatus === 'success' && 'Synced'}
              {crmSyncStatus === 'error' && 'Sync failed'}
            </Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Apollo Info */}
      {destination === 'apollo' && (
        <Alert className="bg-amber-500/10 border-amber-500/50">
          <Zap className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <div className="font-medium mb-1">Redeem contacts from Apollo</div>
            <p className="text-sm text-muted-foreground">
              {dataSource === 'database' ? (
                <>
                  Contacts will be imported from Apollo Available Market ({formatNumber(apolloTamData?.total_accounts || 0)} accounts available). 
                  Use persona filters in the next step to narrow down contacts.
                </>
              ) : (
                <>
                  Contacts will be imported from Apollo for the {formatNumber(previewData?.length || 0)} selected accounts. 
                  Duplicates (existing leads, CRM contacts, previous exports) will be automatically skipped.
                </>
              )}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {destination === 'apollo' ? (
        <Button
          onClick={onOpenApolloRedemption}
          disabled={
            dataSource === 'database' 
              ? apolloTamDomains.length === 0 
              : (!previewData || previewData.length === 0)
          }
          className="w-full"
          size="lg"
        >
          <Zap className="mr-2 h-4 w-4" />
          Configure Apollo Redemption (max 1,000 per batch)
        </Button>
      ) : (
        <Button
          onClick={onCreateCampaign}
          disabled={isPushing || !previewData || previewData.length === 0}
          className="w-full"
          size="lg"
        >
          {isPushing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Campaign...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Create Campaign
            </>
          )}
        </Button>
      )}
    </div>
  );
}
