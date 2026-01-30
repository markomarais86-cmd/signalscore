import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Database, Globe, Zap } from "lucide-react";
import { ApolloCreditsDisplay } from "../ApolloCreditsDisplay";
import { formatNumber } from "@/utils/format-numbers";
interface DataSourceStepProps {
  dataSource: 'all' | 'crm' | 'database';
  setDataSource: (source: 'all' | 'crm' | 'database') => void;
  provider: 'apollo' | 'zoominfo' | 'clearbit';
  setProvider: (provider: 'apollo' | 'zoominfo' | 'clearbit') => void;
  estimatedCost: number;
  apolloTamData: any;
}

export function DataSourceStep({
  dataSource,
  setDataSource,
  provider,
  setProvider,
  estimatedCost,
  apolloTamData
}: DataSourceStepProps) {
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
              (requires credits, typically $0.50-$1.00 per contact).
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
            <Card 
              className={`cursor-pointer transition-all ${provider === 'apollo' ? 'border-primary ring-2 ring-primary' : ''}`}
              onClick={() => setProvider('apollo')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Apollo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">~$0.50/contact</p>
                {provider === 'apollo' && (
                  <div className="mt-2 pt-2 border-t">
                    <ApolloCreditsDisplay compact />
                  </div>
                )}
              </CardContent>
            </Card>
            
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

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Estimated cost: <strong>${estimatedCost.toFixed(2)}</strong> based on selected accounts
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
