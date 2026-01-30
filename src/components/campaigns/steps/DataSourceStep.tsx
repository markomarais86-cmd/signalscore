import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Database, Globe, Zap, Info } from "lucide-react";
import { ApolloCreditsDisplay } from "../ApolloCreditsDisplay";
import { ProviderHealthBadge } from "../ProviderHealthBadge";
import { formatNumber } from "@/utils/format-numbers";
import { useProviderHealth, useEnrichmentCostEstimate, getProviderCost } from "@/hooks/use-provider-health";

interface DataSourceStepProps {
  dataSource: 'all' | 'crm' | 'database';
  setDataSource: (source: 'all' | 'crm' | 'database') => void;
  provider: 'apollo' | 'zoominfo' | 'clearbit';
  setProvider: (provider: 'apollo' | 'zoominfo' | 'clearbit') => void;
  estimatedCost: number;
  apolloTamData: any;
  selectedAccountCount?: number;
}

export function DataSourceStep({
  dataSource,
  setDataSource,
  provider,
  setProvider,
  estimatedCost,
  apolloTamData,
  selectedAccountCount = 0
}: DataSourceStepProps) {
  // Real-time provider health from service_health table
  const { data: providerHealth, isLoading: isLoadingHealth } = useProviderHealth(['apollo', 'pdl', 'hunter']);
  
  // Dynamic cost estimation from edge function
  const { data: costEstimate, isLoading: isLoadingCost } = useEnrichmentCostEstimate(
    selectedAccountCount,
    ['perplexity', 'firecrawl', 'claude', 'pdl', 'apollo', 'hunter']
  );

  const apolloHealth = providerHealth?.apollo;
  const apolloCost = getProviderCost('apollo');
  
  // Use dynamic cost if available, otherwise fall back to prop
  const displayCost = costEstimate?.totalCost ?? estimatedCost;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Select Data Provider</h3>
        <p className="text-sm text-muted-foreground">Choose your contact data enrichment provider</p>
      </div>

      <Alert className="bg-muted/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-2">Data Source Explained</div>
          <div className="space-y-2 text-sm">
            <div>
              <strong>CRM:</strong> Use your existing contacts (free, no enrichment cost). 
              Campaign-ready contacts have email, title, and persona already identified.
            </div>
            <div>
              <strong>Database:</strong> Enrich from external providers like Apollo 
              (requires credits, costs vary by provider).
            </div>
          </div>
        </AlertDescription>
      </Alert>
      
      <div className="flex items-center space-x-4">
        <Label>Data Source:</Label>
        <Select value={dataSource} onValueChange={(value) => setDataSource(value as 'all' | 'crm' | 'database')}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="crm">CRM Only (Free)</SelectItem>
            <SelectItem value="database">External Database</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dataSource === 'database' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Apollo - Active Provider */}
            <Card 
              className={`cursor-pointer transition-all ${provider === 'apollo' ? 'border-primary ring-2 ring-primary' : ''} ${apolloHealth?.status === 'down' ? 'opacity-60' : ''}`}
              onClick={() => apolloHealth?.status !== 'down' && setProvider('apollo')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Apollo
                  </CardTitle>
                  <ProviderHealthBadge 
                    status={apolloHealth?.status || 'healthy'} 
                    isLoading={isLoadingHealth}
                    avgResponseTimeMs={apolloHealth?.avgResponseTimeMs}
                    failureCount={apolloHealth?.failureCount}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        ~${apolloCost?.costPerContact.toFixed(3) || '0.015'}/contact
                        <Info className="h-3 w-3" />
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <p><strong>Apollo API cost</strong></p>
                        <p>Success rate: ~{apolloCost?.estimatedSuccessRate || 35}%</p>
                        <p>Used as last-resort fallback in waterfall</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {provider === 'apollo' && (
                  <div className="mt-2 pt-2 border-t">
                    <ApolloCreditsDisplay compact />
                  </div>
                )}
                {apolloHealth?.status === 'down' && (
                  <p className="text-xs text-destructive mt-2">
                    Provider temporarily unavailable
                  </p>
                )}
              </CardContent>
            </Card>
            
            {/* ZoomInfo - Coming Soon */}
            <Card 
              className="opacity-60 cursor-not-allowed relative"
              title="ZoomInfo integration coming soon"
            >
              <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground" variant="secondary">Coming Soon</Badge>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  ZoomInfo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">~$0.75/contact</p>
              </CardContent>
            </Card>
            
            {/* Clearbit - Coming Soon */}
            <Card 
              className="opacity-60 cursor-not-allowed relative"
              title="Clearbit integration coming soon"
            >
              <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground" variant="secondary">Coming Soon</Badge>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-purple-500" />
                  Clearbit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">~$1.00/contact</p>
              </CardContent>
            </Card>
          </div>

          {apolloTamData && provider === 'apollo' && (
            <Card className="bg-amber-500/5 border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Apollo Available Market
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{formatNumber(apolloTamData.total_accounts || 0)}</div>
                    <div className="text-xs text-muted-foreground">Total Accounts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatNumber(apolloTamData.total_contacts || 0)}</div>
                    <div className="text-xs text-muted-foreground">Total Contacts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-500">{formatNumber(apolloTamData.credits_remaining || 0)}</div>
                    <div className="text-xs text-muted-foreground">Credits Available</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-500">
                      {Object.keys(apolloTamData.industry_breakdown || {}).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Industries</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost Breakdown */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>
                  Estimated cost: <strong>${displayCost.toFixed(2)}</strong>
                  {selectedAccountCount > 0 && (
                    <span className="text-muted-foreground ml-1">
                      ({selectedAccountCount} accounts)
                    </span>
                  )}
                </span>
                {costEstimate?.breakdown && costEstimate.breakdown.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="cursor-help gap-1">
                          <Info className="h-3 w-3" />
                          Cost Breakdown
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="w-72">
                        <div className="text-xs space-y-2">
                          <p className="font-semibold mb-2">Waterfall Cost Breakdown</p>
                          {costEstimate.breakdown.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="capitalize">{item.provider}</span>
                              <span>
                                {item.accountCount} × ${item.costPerAccount.toFixed(3)} = ${item.totalCost.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          <div className="border-t pt-1 mt-1 font-semibold flex justify-between">
                            <span>Total</span>
                            <span>${costEstimate.totalCost.toFixed(2)}</span>
                          </div>
                          {costEstimate.estimatedDuration && (
                            <p className="text-muted-foreground mt-1">
                              Est. duration: {costEstimate.estimatedDuration}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {costEstimate?.warnings && costEstimate.warnings.length > 0 && (
                <div className="mt-2 text-xs text-yellow-600">
                  {costEstimate.warnings.map((warning, i) => (
                    <p key={i}>⚠️ {warning}</p>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
