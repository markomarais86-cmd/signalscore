import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  ExternalLink, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Users, 
  DollarSign,
  TrendingUp,
  Calendar,
  Target,
  Sparkles,
  Activity
} from "lucide-react";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";
import { AITechnologyInsights } from "@/components/AITechnologyInsights";

interface Account {
  id: string;
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  updated_at: string;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
  } | null;
  contacts?: any[];
}

interface AccountDetailDrawerProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onViewScore: (account: Account) => void;
}

export function AccountDetailDrawer({ account, isOpen, onClose, onViewScore }: AccountDetailDrawerProps) {
  if (!account) return null;

  const calculateDataCompleteness = (acc: Account) => {
    const fields = [acc.name, acc.domain, acc.industry_norm, acc.employee_count, acc.revenue_range, acc.country];
    const filledFields = fields.filter(Boolean).length;
    return Number(((filledFields / fields.length) * 100).toFixed(2));
  };

  const completeness = calculateDataCompleteness(account);

  const getDataQualityBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-[hsl(var(--signal-high))]">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-[hsl(var(--signal-medium))]">Good</Badge>;
    if (score >= 40) return <Badge className="bg-primary">Fair</Badge>;
    return <Badge className="bg-[hsl(var(--signal-low))]">Needs Enrichment</Badge>;
  };

  // Mock activity timeline
  const activityTimeline = [
    { date: '2024-01-15', type: 'enrichment', description: 'Data enriched from public sources', icon: Sparkles },
    { date: '2024-01-10', type: 'score', description: 'ICP score calculated', icon: Target },
    { date: '2024-01-05', type: 'upload', description: 'Account imported from CSV', icon: Activity },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-2xl flex items-center gap-3">
                {account.name || 'Unknown Company'}
                {account.domain && (
                  <a
                    href={`https://${account.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                )}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{account.industry_norm || account.industry_raw || 'Unknown Industry'}</Badge>
                <Badge variant="outline">{account.country || 'Unknown Location'}</Badge>
              </SheetDescription>
            </div>
            {account.score && (
              <SignalScoreDisplay score={account.score.overall} size="lg" />
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts
              {account.contacts && account.contacts.length > 0 && (
                <Badge variant="secondary" className="ml-2">{account.contacts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Score Breakdown */}
            {account.score && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    ICP Scoring
                  </CardTitle>
                  <CardDescription>How this account matches your ideal customer profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-1">{account.score.fit}</div>
                      <div className="text-sm text-muted-foreground">Fit Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-1">{account.score.intent}</div>
                      <div className="text-sm text-muted-foreground">Intent Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-1">{account.score.reachability}</div>
                      <div className="text-sm text-muted-foreground">Reachability</div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => onViewScore(account)}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Detailed Score Breakdown
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Firmographic Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Domain</Label>
                    <p className="text-sm mt-1">{account.domain || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">External ID</Label>
                    <p className="text-sm mt-1">{account.external_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Industry</Label>
                    <p className="text-sm mt-1">{account.industry_norm || account.industry_raw || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Location</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {account.country || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Employee Count</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {account.employee_count?.toLocaleString() || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Revenue Range</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {account.revenue_range || '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Data Quality
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Completeness:</span>
                  {getDataQualityBadge(completeness)}
                </div>
                <Progress value={completeness} className="h-2" />
                <p className="text-sm text-muted-foreground">{completeness}% of fields populated</p>
                
                {completeness < 80 && (
                  <div className="bg-muted p-3 rounded-lg mt-3">
                    <p className="text-sm font-medium mb-2">Suggestions for Improvement:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {!account.domain && <li>• Add company domain for enrichment opportunities</li>}
                      {!account.employee_count && <li>• Add employee count for better ICP matching</li>}
                      {!account.revenue_range && <li>• Add revenue range for qualification</li>}
                      {!account.country && <li>• Add location for territory planning</li>}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4 mt-4">
            {account.contacts && account.contacts.length > 0 ? (
              account.contacts.map((contact, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">
                          {contact.first_name} {contact.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">{contact.title_raw || '-'}</p>
                        <div className="flex gap-4 mt-3">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-sm flex items-center gap-1 text-primary hover:underline">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          )}
                          {contact.country && (
                            <span className="text-sm flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {contact.country}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {contact.persona && (
                          <Badge variant="outline">{contact.persona}</Badge>
                        )}
                        {contact.level && (
                          <Badge variant="secondary">{contact.level}</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h4 className="font-semibold mb-2">No Contacts Found</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add contacts to this account to improve reachability score
                  </p>
                  <Button variant="outline">Import Contacts</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-4 mt-4">
            <AITechnologyInsights accountIds={[account.id]} />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Engagement Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Best Time to Engage</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tuesday-Thursday, 10am-2pm {account.country ? `(${account.country} timezone)` : ''}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Recommended Approach</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Multi-threaded outreach with emphasis on {account.contacts && account.contacts.length > 0 ? 'existing contacts' : 'decision-makers'}
                    </p>
                  </div>
                </div>

                <Separator />
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Key Messaging</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Focus on {account.industry_norm || 'industry'}-specific pain points and ROI metrics
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Account Timeline
                </CardTitle>
                <CardDescription>Recent events and updates for this account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activityTimeline.map((event, idx) => {
                    const Icon = event.icon;
                    return (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="p-2 bg-muted rounded-full">
                            <Icon className="h-4 w-4" />
                          </div>
                          {idx < activityTimeline.length - 1 && (
                            <div className="w-px h-full bg-border mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium">{event.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(event.date).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
