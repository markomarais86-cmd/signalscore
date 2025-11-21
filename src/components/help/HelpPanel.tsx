import { useState } from "react";
import { HelpCircle, BookOpen, CheckCircle2, Lightbulb, Settings, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export function HelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Help & Documentation</SheetTitle>
          <SheetDescription>
            Get started quickly and find answers to common questions
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="quickstart" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
            <TabsTrigger value="concepts">Key Concepts</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-200px)] mt-4">
            <TabsContent value="quickstart" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    5-Minute Quick Start
                  </CardTitle>
                  <CardDescription>Follow these steps to get started</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">1</Badge>
                      <div>
                        <p className="font-medium">Upload Your Data</p>
                        <p className="text-sm text-muted-foreground">Go to Data Upload and import your accounts and leads from CSV or connect your CRM</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-3">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">2</Badge>
                      <div>
                        <p className="font-medium">Create Your ICP</p>
                        <p className="text-sm text-muted-foreground">Define your Ideal Customer Profile in ICP Manager by selecting industries, company sizes, and regions</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-3">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">3</Badge>
                      <div>
                        <p className="font-medium">Score Your Accounts</p>
                        <p className="text-sm text-muted-foreground">The system automatically scores accounts against your ICP (you'll see this on the Overview)</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-3">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">4</Badge>
                      <div>
                        <p className="font-medium">Build Your First Campaign</p>
                        <p className="text-sm text-muted-foreground">Click "Build Campaign" from the Overview to target high-fit accounts</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Pro Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm space-y-1">
                    <p className="font-medium">💡 Enrich your data for better scoring</p>
                    <p className="text-muted-foreground">Missing employee count or revenue? Use enrichment in Settings to fill gaps</p>
                  </div>
                  <Separator />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">💡 Filter by data source</p>
                    <p className="text-muted-foreground">Toggle between CRM and Database views on the Overview to see different data sets</p>
                  </div>
                  <Separator />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">💡 Update your ICP regularly</p>
                    <p className="text-muted-foreground">As you close deals, refine your ICP to reflect winning patterns</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="concepts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Understanding Key Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium mb-1">ICP Fit Score (0-100)</p>
                    <p className="text-sm text-muted-foreground">Measures how well an account matches your Ideal Customer Profile based on industry, company size, revenue, and geography.</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between"><span>70-100: High Fit</span><Badge variant="default">Target first</Badge></div>
                      <div className="flex justify-between"><span>40-69: Medium Fit</span><Badge variant="secondary">Review</Badge></div>
                      <div className="flex justify-between"><span>0-39: Low Fit</span><Badge variant="outline">Deprioritize</Badge></div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-1">Data Completeness</p>
                    <p className="text-sm text-muted-foreground">Percentage of accounts with complete firmographic data (industry, employee count, revenue, location). Higher completeness = more accurate scoring.</p>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-1">TAM (Total Addressable Market)</p>
                    <p className="text-sm text-muted-foreground">The total number of accounts that match your ICP criteria, representing your full market opportunity.</p>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-1">SAM (Serviceable Available Market)</p>
                    <p className="text-sm text-muted-foreground">High-fit accounts (70+ score) within your TAM that you can realistically target.</p>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-1">Campaign Ready</p>
                    <p className="text-sm text-muted-foreground">High-fit accounts with valid leads (email, title, persona) ready for outreach campaigns.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Sources Explained</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Badge variant="default" className="mb-1">CRM</Badge>
                    <p className="text-sm text-muted-foreground">Accounts synced from your connected CRM (Salesforce, HubSpot, etc.)</p>
                  </div>
                  <div>
                    <Badge variant="secondary" className="mb-1">Database</Badge>
                    <p className="text-sm text-muted-foreground">Accounts from external data providers (Apollo, ZoomInfo, etc.)</p>
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-1">Both</Badge>
                    <p className="text-sm text-muted-foreground">Accounts that exist in both your CRM and external database</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workflows" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Common Workflows</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium mb-2">🎯 Building a Target Account List</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Go to Accounts page</li>
                      <li>Filter by Fit Score (70-100 for high fit)</li>
                      <li>Add additional filters (industry, region, etc.)</li>
                      <li>Export filtered list or build a campaign</li>
                    </ol>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-2">📊 Improving Data Quality</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Check Data Completeness metric on Overview</li>
                      <li>Go to Settings → Enrichment</li>
                      <li>Select "Smart Enrich" to auto-fill missing data</li>
                      <li>Review enriched accounts on Accounts page</li>
                    </ol>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-2">🎪 Launching an Outbound Campaign</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Ensure you have an active ICP</li>
                      <li>Click "Build Campaign" from Overview</li>
                      <li>Select target criteria and personas</li>
                      <li>Choose data source (CRM leads)</li>
                      <li>Preview and export to CRM or CSV</li>
                    </ol>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium mb-2">🔄 Refining Your ICP</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Upload closed-won deals in Data Upload</li>
                      <li>Go to ICP Manager</li>
                      <li>Review AI insights for winning patterns</li>
                      <li>Update ICP criteria based on insights</li>
                      <li>Scores update automatically</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Troubleshooting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium text-sm">❓ Why am I seeing 0 campaign results?</p>
                    <p className="text-sm text-muted-foreground">Check that you have: (1) High-fit accounts, (2) Leads linked to those accounts, and (3) Correct data source selected (CRM vs Database)</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-medium text-sm">❓ Why aren't my scores updating?</p>
                    <p className="text-sm text-muted-foreground">Scores update automatically when you change your ICP. Check for a background scoring job in Settings → System Status.</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-medium text-sm">❓ How do I improve data completeness?</p>
                    <p className="text-sm text-muted-foreground">Use enrichment tools in Settings to fill missing firmographic fields (company size, revenue, industry).</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
