import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Settings as SettingsIcon, 
  User, 
  Users, 
  Database, 
  Bell, 
  Key, 
  CreditCard, 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Copy,
  Eye,
  EyeOff,
  Download,
  Upload,
  Zap,
  Mail,
  Webhook,
  GitBranch,
  BarChart3,
  Bot,
  Target
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import IntegrationManager from "@/components/settings/IntegrationManager";
import WebhookLogViewer from "@/components/settings/WebhookLogViewer";
import DataMapping from "@/components/settings/DataMapping";
import ScoringConfiguration from "@/components/settings/ScoringConfiguration";
import BenchmarkSettings from "@/components/settings/BenchmarkSettings";
import AIAgentSettings from "@/components/settings/AIAgentSettings";
import { AccountExclusions } from "@/components/settings/AccountExclusions";
import { ZapierIntegration } from "@/components/settings/ZapierIntegration";
import { APIKeyManager } from "@/components/settings/APIKeyManager";
import { ExternalDataProviders } from "@/components/settings/ExternalDataProviders";
import { RateLimitSettings } from "@/components/settings/RateLimitSettings";
import { AutomationSettings } from "@/components/settings/AutomationSettings";
import { ZapierWebhookManager } from "@/components/settings/ZapierWebhookManager";
import { ClayIncomingWebhooks } from "@/components/settings/ClayIncomingWebhooks";
import { DuplicateAccountMerger } from "@/components/settings/DuplicateAccountMerger";
import { FirmographicEnrichmentCard } from "@/components/settings/FirmographicEnrichmentCard";
import { EnrichmentQualityDashboard } from "@/components/settings/EnrichmentQualityDashboard";
import { EnrichmentTester } from "@/components/settings/EnrichmentTester";
import { EnrichmentJobMonitor } from "@/components/settings/EnrichmentJobMonitor";
import { EnrichmentAttributionReport } from "@/components/settings/EnrichmentAttributionReport";
import { DataQualityDashboard } from "@/components/settings/DataQualityDashboard";
import { InvitationsManager } from "@/components/settings/InvitationsManager";
import { EnrichmentAPIKeys } from "@/components/settings/EnrichmentAPIKeys";
import { EnrichmentProviderSetup } from "@/components/settings/EnrichmentProviderSetup";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { LeadsBackfill } from "@/components/settings/LeadsBackfill";
import { LeadDiscovery } from "@/components/settings/LeadDiscovery";
import { EnrichmentDiscoverySettings } from "@/components/settings/EnrichmentDiscoverySettings";
import { IntegrationCredentialManager } from "@/components/settings/IntegrationCredentialManager";
import { IntegrationHealthDashboard } from "@/components/settings/IntegrationHealthDashboard";
import { SmartEnrichmentPanel } from "@/components/settings/SmartEnrichmentPanel";
import { EnrichmentHealthCard } from "@/components/settings/EnrichmentHealthCard";
import { EnhancedEnrichmentHealth } from "@/components/settings/EnhancedEnrichmentHealth";
import { EnrichmentHistoryViewer } from "@/components/settings/EnrichmentHistoryViewer";
import { DeepResearchSettings } from "@/components/settings/DeepResearchSettings";
import { EnrichmentAnalyticsDashboard } from "@/components/settings/EnrichmentAnalyticsDashboard";
import { CandidateSelector } from "@/components/enrichment/CandidateSelector";
import { UnifiedEnrichmentDashboard } from "@/components/enrichment/UnifiedEnrichmentDashboard";
import { BulkLeadEnrichment } from "@/components/settings/BulkLeadEnrichment";
import { LeadEnrichmentPanel } from "@/components/settings/LeadEnrichmentPanel";
import { BulkAccountEnrichment } from "@/components/settings/BulkAccountEnrichment";
import { CRMSyncHistory } from "@/components/settings/CRMSyncHistory";
import { ExportHistory } from "@/components/settings/ExportHistory";
import { CampaignExportHistory } from "@/components/campaigns/CampaignExportHistory";
import { ScoreRefreshPanel } from "@/components/settings/ScoreRefreshPanel";
import { LaunchPulseMark } from "@/components/BrandLogo";

import { supabase } from "@/integrations/supabase/client";
import { AIProviderSettings } from "@/components/settings/AIProviderSettings";
import { SettingsSkeleton } from "@/components/SettingsSkeleton";
import DataUploadContent from "@/components/settings/DataUploadContent";
import { ServiceHealthStatus } from "@/components/settings/ServiceHealthStatus";

interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  status: 'active' | 'pending' | 'inactive';
  last_active?: string;
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "account");
  const [triggerEnrich, setTriggerEnrich] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    const saved = localStorage.getItem('showAdvancedSettings');
    return saved === 'true';
  });
  
  // Account settings
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    company: '',
    role: '',
    avatar_url: ''
  });
  
  // Team management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Organization settings
  const [orgSettings, setOrgSettings] = useState({
    name: '',
    timezone: 'UTC'
  });
  
  const { userProfile, user } = useAuth();
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  const isAdmin = isSuperAdmin || isOrgAdmin;
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [userProfile]);

  // Handle query params for enrichment trigger
  useEffect(() => {
    const tab = searchParams.get("tab");
    const action = searchParams.get("action");
    
    if (tab === "integrations" && action === "enrich") {
      setActiveTab("integrations");
      setTriggerEnrich(true);
      // Clear query params
      setSearchParams({});
      
      // Scroll to enrichment card after a short delay
      setTimeout(() => {
        const enrichmentCard = document.getElementById("enrichment-card");
        if (enrichmentCard) {
          enrichmentCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [searchParams, setSearchParams]);

  const loadSettings = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      // Load profile
      setProfile({
        full_name: userProfile.full_name || '',
        email: user?.email || '',
        company: (userProfile as any).company || '',
        role: userProfile.role || '',
        avatar_url: (userProfile as any).avatar_url || ''
      });

      // Load organization settings
      if (userProfile.org_id) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', userProfile.org_id)
          .single();
        
        if (org && !orgError) {
          setOrgSettings(prev => ({ ...prev, name: org.name }));
        }
      }

      // Load real team members
      await loadTeamMembers();

    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_users_with_emails', {
        p_org_id: userProfile.org_id
      });
      
      if (error) {
        console.error('Error loading team members:', error);
        return;
      }
      
      if (!data) return;
      
      // Transform to TeamMember format
      const members: TeamMember[] = data.map((user: any) => ({
        id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.profile_role || 'user',
        status: 'active',
        last_active: undefined
      }));
      
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const updateProfile = async () => {
    try {
      // This would update the user profile in Supabase
      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    }
  };


  const getRoleBadge = (role: string) => {
    const variants = {
      admin: 'default',
      user: 'secondary',
      viewer: 'outline'
    } as const;
    return <Badge variant={variants[role as keyof typeof variants]}>{role}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      pending: 'secondary',
      inactive: 'outline',
      connected: 'default',
      disconnected: 'secondary',
      error: 'destructive'
    } as const;
    return <Badge variant={variants[status as keyof typeof variants]}>{status}</Badge>;
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, team, and application preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto scrollbar-hide">
          <TabsTrigger value="account" className="flex items-center gap-2 flex-shrink-0">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2 flex-shrink-0">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
          <TabsTrigger value="data-upload" className="flex items-center gap-2 flex-shrink-0">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Data Upload</span>
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2 flex-shrink-0">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2 flex-shrink-0">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data & Enrichment</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="automation" className="flex items-center gap-2 flex-shrink-0">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Automation & AI</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="export-history" className="flex items-center gap-2 flex-shrink-0">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exports</span>
          </TabsTrigger>
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and profile settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback>{profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">Change Avatar</Button>
                  <p className="text-sm text-muted-foreground mt-1">JPG, PNG or GIF. Max size 5MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={profile.full_name}
                    onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={profile.company}
                    onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Job Title</Label>
                  <Input
                    id="role"
                    value={profile.role}
                    onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>
              </div>

              <Button onClick={updateProfile}>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Configure organization-wide settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input 
                  id="orgName" 
                  value={orgSettings.name}
                  onChange={(e) => setOrgSettings(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={orgSettings.timezone}
                  onValueChange={(value) => setOrgSettings(prev => ({ ...prev, timezone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="EST">Eastern Time</SelectItem>
                    <SelectItem value="PST">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Upload Tab */}
        <TabsContent value="data-upload" className="space-y-6">
          <DataUploadContent />
        </TabsContent>

        {/* Configuration: Scoring, Benchmarks, Data Mapping, Exclusions */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Configuration</CardTitle>
              <CardDescription>Configure ICP scoring and account matching</CardDescription>
            </CardHeader>
          </Card>
          <ScoringConfiguration />
          <BenchmarkSettings />
          <ScoreRefreshPanel />
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Manage data quality and mappings</CardDescription>
            </CardHeader>
          </Card>
          <DuplicateAccountMerger />
          <DataMapping />
          <AccountExclusions />
        </TabsContent>

        {/* Automation & AI: Automation, AI Agents - Admin Only */}
        {isAdmin && (
          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Automation & AI Settings</CardTitle>
                <CardDescription>Configure automated workflows and AI agent behavior</CardDescription>
              </CardHeader>
            </Card>
            <AutomationSettings />
            <AIAgentSettings />
          </TabsContent>
        )}

        {/* Team Management */}
        <TabsContent value="team" className="space-y-6">
          <InvitationsManager />
          
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Current members in your organization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {teamMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No team members yet</p>
                  <p className="text-sm">Use the invite section above to add team members</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{member.full_name?.charAt(0) || member.email.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name || member.email}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                          {member.last_active && (
                            <p className="text-xs text-muted-foreground">
                              Last active: {new Date(member.last_active).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleBadge(member.role)}
                        {getStatusBadge(member.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Enrichment: All data sources, enrichment, integrations, API */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Advanced Settings Toggle - Admin Only */}
          {isAdmin && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="advanced-toggle" className="text-base font-semibold">
                      Advanced Settings
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Show advanced options for CRM sync, API management, analytics, and external integrations
                    </p>
                  </div>
                  <Switch
                    id="advanced-toggle"
                    checked={showAdvanced}
                    onCheckedChange={(checked) => {
                      setShowAdvanced(checked);
                      localStorage.setItem('showAdvancedSettings', checked.toString());
                    }}
                  />
                </div>
                {showAdvanced && (
                  <div className="mt-4 pt-4 border-t">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      🔓 Advanced Settings Enabled
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Accordion 
            type="multiple" 
            defaultValue={showAdvanced ? ["quick-actions", "monitoring", "setup"] : ["quick-actions", "monitoring"]} 
            className="space-y-4"
          >
            
            {/* Quick Actions Section */}
            <AccordionItem value="quick-actions" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Quick Actions</p>
                    <p className="text-sm text-muted-foreground">Start enrichment and discover leads</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <Tabs defaultValue="smart" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="multi-agent">Multi-Agent AI</TabsTrigger>
                    <TabsTrigger value="discovery">Contact Discovery</TabsTrigger>
                    <TabsTrigger value="smart">Smart Enrichment</TabsTrigger>
                    <TabsTrigger value="accounts">Accounts</TabsTrigger>
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                  </TabsList>
                  <TabsContent value="multi-agent" className="mt-4">
                    <LeadEnrichmentPanel />
                  </TabsContent>
                  <TabsContent value="discovery" className="mt-4">
                    <EnrichmentDiscoverySettings />
                  </TabsContent>
                  <TabsContent value="smart" className="mt-4">
                    <SmartEnrichmentPanel />
                  </TabsContent>
                  <TabsContent value="accounts" className="mt-4">
                    <BulkAccountEnrichment />
                  </TabsContent>
                  <TabsContent value="leads" className="mt-4">
                    <BulkLeadEnrichment />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* Active Jobs & Monitoring */}
            <AccordionItem value="monitoring" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Active Jobs & Monitoring</p>
                    <p className="text-sm text-muted-foreground">Real-time enrichment job status</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="space-y-6">
                  <UnifiedEnrichmentDashboard />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Data Quality & Firmographic Sync - Always visible */}
            <AccordionItem value="data-quality" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Data Quality & Firmographic Sync</p>
                    <p className="text-sm text-muted-foreground">Sync data between accounts and leads, enrich HQ addresses</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <DataQualityDashboard />
              </AccordionContent>
            </AccordionItem>

            {/* Advanced sections - Admin only and conditionally rendered */}
            {isAdmin && showAdvanced && (
              <>
                {/* Analytics & Quality */}
                <AccordionItem value="analytics" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Analytics & Quality</p>
                    <p className="text-sm text-muted-foreground">Quality metrics and attribution reports</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <Tabs defaultValue="quality" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="quality">Quality</TabsTrigger>
                    <TabsTrigger value="attribution">Attribution</TabsTrigger>
                    <TabsTrigger value="backfill">Backfill</TabsTrigger>
                  </TabsList>
                  <TabsContent value="quality" className="mt-4">
                    <EnrichmentQualityDashboard />
                  </TabsContent>
                  <TabsContent value="attribution" className="mt-4">
                    <EnrichmentAttributionReport />
                  </TabsContent>
                  <TabsContent value="backfill" className="mt-4">
                    <LeadsBackfill />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* Deep Research */}
            <AccordionItem value="deep-research" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <LaunchPulseMark className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-semibold">Deep Research & Analytics</p>
                    <p className="text-sm text-muted-foreground">AI-powered enrichment and cost management</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <DeepResearchSettings />
                <Button onClick={() => setShowCandidateSelector(true)} variant="outline" className="w-full">
                  Review Ambiguous Matches
                </Button>
                <EnrichmentAnalyticsDashboard />
              </AccordionContent>
            </AccordionItem>

            {/* Advanced Tools */}
            <AccordionItem value="advanced" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Advanced Tools</p>
                    <p className="text-sm text-muted-foreground">Manual testing and specialized enrichment</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <EnrichmentTester />
              </AccordionContent>
            </AccordionItem>

            {/* Provider Setup */}
            <AccordionItem value="setup" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Provider Setup</p>
                    <p className="text-sm text-muted-foreground">Configure API keys and rate limits</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <ServiceHealthStatus />
                <EnrichmentProviderSetup />
                <RateLimitSettings />
              </AccordionContent>
            </AccordionItem>

            {/* External Database Connections */}
            <AccordionItem value="external-data" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">External Database Connections</p>
                    <p className="text-sm text-muted-foreground">Apollo, ZoomInfo, and other data providers</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <ExternalDataProviders />
              </AccordionContent>
            </AccordionItem>

            {/* External Integrations */}
            <AccordionItem value="integrations" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">External Integrations</p>
                    <p className="text-sm text-muted-foreground">CRM connectors and webhooks</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <AIProviderSettings />
                <IntegrationHealthDashboard />
                <IntegrationCredentialManager />
                <IntegrationManager />
                {userProfile?.org_id && <CRMSyncHistory orgId={userProfile.org_id} />}
                <CampaignExportHistory />
                <WebhookLogViewer />
                <ZapierIntegration />
                <ClayIncomingWebhooks />
              </AccordionContent>
            </AccordionItem>
              </>
            )}

          </Accordion>

          <CandidateSelector 
            isOpen={showCandidateSelector} 
            onClose={() => setShowCandidateSelector(false)} 
          />
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password & Authentication</CardTitle>
              <CardDescription>Manage your password and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input type="password" placeholder="Enter current password" />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" placeholder="Enter new password" />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" placeholder="Confirm new password" />
              </div>
              <Button>Update Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Two-factor authentication</p>
                  <p className="text-sm text-muted-foreground">Currently disabled</p>
                </div>
                <Button variant="outline">Enable 2FA</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your active login sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">MacBook Pro • Chrome • San Francisco, CA</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>Download your data or request account deletion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-muted-foreground">Download all your account data</p>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export History */}
        <TabsContent value="export-history" className="space-y-6">
          <ExportHistory />
        </TabsContent>
      </Tabs>

      <EnrichmentModal
        open={showEnrichmentModal}
        onOpenChange={setShowEnrichmentModal}
      />
    </div>
  );
}