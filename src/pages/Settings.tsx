import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  Target,
  Route,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SettingsSkeleton } from "@/components/SettingsSkeleton";

// Lazy-loaded components for better performance
const IntegrationManager = lazy(() => import("@/components/settings/IntegrationManager"));
const WebhookLogViewer = lazy(() => import("@/components/settings/WebhookLogViewer"));
const DataMapping = lazy(() => import("@/components/settings/DataMapping"));
const ScoringConfiguration = lazy(() => import("@/components/settings/ScoringConfiguration"));
const BenchmarkSettings = lazy(() => import("@/components/settings/BenchmarkSettings"));
const AIAgentSettings = lazy(() => import("@/components/settings/AIAgentSettings"));
const AccountExclusions = lazy(() => import("@/components/settings/AccountExclusions").then(m => ({ default: m.AccountExclusions })));
const ZapierIntegration = lazy(() => import("@/components/settings/ZapierIntegration").then(m => ({ default: m.ZapierIntegration })));
const APIKeyManager = lazy(() => import("@/components/settings/APIKeyManager").then(m => ({ default: m.APIKeyManager })));
const ExternalDataProviders = lazy(() => import("@/components/settings/ExternalDataProviders").then(m => ({ default: m.ExternalDataProviders })));
const RateLimitSettings = lazy(() => import("@/components/settings/RateLimitSettings").then(m => ({ default: m.RateLimitSettings })));
const APIRateLimitDashboard = lazy(() => import("@/components/settings/APIRateLimitDashboard").then(m => ({ default: m.APIRateLimitDashboard })));
const AutomationSettings = lazy(() => import("@/components/settings/AutomationSettings").then(m => ({ default: m.AutomationSettings })));
const ZapierWebhookManager = lazy(() => import("@/components/settings/ZapierWebhookManager").then(m => ({ default: m.ZapierWebhookManager })));
const ClayIncomingWebhooks = lazy(() => import("@/components/settings/ClayIncomingWebhooks").then(m => ({ default: m.ClayIncomingWebhooks })));
const DuplicateAccountMerger = lazy(() => import("@/components/settings/DuplicateAccountMerger").then(m => ({ default: m.DuplicateAccountMerger })));
const EnrichmentProviderSetup = lazy(() => import("@/components/settings/EnrichmentProviderSetup").then(m => ({ default: m.EnrichmentProviderSetup })));
const InvitationsManager = lazy(() => import("@/components/settings/InvitationsManager").then(m => ({ default: m.InvitationsManager })));
const IntegrationCredentialManager = lazy(() => import("@/components/settings/IntegrationCredentialManager").then(m => ({ default: m.IntegrationCredentialManager })));
const IntegrationHealthDashboard = lazy(() => import("@/components/settings/IntegrationHealthDashboard").then(m => ({ default: m.IntegrationHealthDashboard })));
const CRMSyncHistory = lazy(() => import("@/components/settings/CRMSyncHistory").then(m => ({ default: m.CRMSyncHistory })));
const ExportHistory = lazy(() => import("@/components/settings/ExportHistory").then(m => ({ default: m.ExportHistory })));
const CampaignExportHistory = lazy(() => import("@/components/campaigns/CampaignExportHistory").then(m => ({ default: m.CampaignExportHistory })));
const ScoreRefreshPanel = lazy(() => import("@/components/settings/ScoreRefreshPanel").then(m => ({ default: m.ScoreRefreshPanel })));
const AIProviderSettings = lazy(() => import("@/components/settings/AIProviderSettings").then(m => ({ default: m.AIProviderSettings })));
const DataUploadContent = lazy(() => import("@/components/settings/DataUploadContent"));
const ServiceHealthStatus = lazy(() => import("@/components/settings/ServiceHealthStatus").then(m => ({ default: m.ServiceHealthStatus })));
const RoutingRulesSettings = lazy(() => import("@/components/settings/RoutingRulesSettings").then(m => ({ default: m.RoutingRulesSettings })));
const AdPlatformAPISettings = lazy(() => import("@/components/settings/AdPlatformAPISettings").then(m => ({ default: m.AdPlatformAPISettings })));
const CustomAttributeManager = lazy(() => import("@/components/settings/CustomAttributeManager"));
const AlertsConfiguration = lazy(() => import("@/components/settings/AlertsConfiguration"));

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
  const [loading, setLoading] = useState(false);
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
  const { effectiveOrgId } = useEffectiveOrg();
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  const isAdmin = isSuperAdmin || isOrgAdmin;
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [userProfile]);


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
      if (effectiveOrgId) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', effectiveOrgId)
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
    if (!effectiveOrgId) return;
    
    try {
      const { data, error } = await supabase.rpc('get_users_with_emails', {
        p_org_id: effectiveOrgId
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account, team, and application preferences
          </p>
        </div>
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
          <TabsTrigger value="custom-attributes" className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Verticals</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2 flex-shrink-0">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="routing" className="flex items-center gap-2 flex-shrink-0">
              <Route className="h-4 w-4" />
              <span className="hidden sm:inline">Routing</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="automation" className="flex items-center gap-2 flex-shrink-0">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Automation & AI</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="alerts" className="flex items-center gap-2 flex-shrink-0">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
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
          <Suspense fallback={<SettingsSkeleton />}>
            <DataUploadContent />
          </Suspense>
        </TabsContent>

        {/* Configuration: Scoring, Benchmarks, Data Mapping, Exclusions */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Configuration</CardTitle>
              <CardDescription>Configure ICP scoring and account matching</CardDescription>
            </CardHeader>
          </Card>
          <Suspense fallback={<SettingsSkeleton />}>
            <ScoringConfiguration />
            <BenchmarkSettings />
            <ScoreRefreshPanel />
          </Suspense>
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Manage data quality and mappings</CardDescription>
            </CardHeader>
          </Card>
          <Suspense fallback={<SettingsSkeleton />}>
            <DuplicateAccountMerger />
            <DataMapping />
            <AccountExclusions />
          </Suspense>
        </TabsContent>

        {/* Custom Vertical Attributes */}
        <TabsContent value="custom-attributes" className="space-y-6">
          <Suspense fallback={<SettingsSkeleton />}>
            <CustomAttributeManager />
          </Suspense>
        </TabsContent>

        {/* Routing Rules - Admin Only */}
        {isAdmin && (
          <TabsContent value="routing" className="space-y-6">
            <Suspense fallback={<SettingsSkeleton />}>
              <RoutingRulesSettings />
            </Suspense>
          </TabsContent>
        )}

        {/* Automation & AI: Automation, AI Agents - Admin Only */}
        {isAdmin && (
          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Automation & AI Settings</CardTitle>
                <CardDescription>Configure automated workflows and AI agent behavior</CardDescription>
              </CardHeader>
            </Card>
            <Suspense fallback={<SettingsSkeleton />}>
              <AutomationSettings />
              <AIAgentSettings />
            </Suspense>
          </TabsContent>
        )}

        {/* Alerts & Notifications - Admin Only */}
        {isAdmin && (
          <TabsContent value="alerts" className="space-y-6">
            <Suspense fallback={<SettingsSkeleton />}>
              <AlertsConfiguration />
            </Suspense>
          </TabsContent>
        )}

        {/* Team Management */}
        <TabsContent value="team" className="space-y-6">
          <Suspense fallback={<SettingsSkeleton />}>
            <InvitationsManager />
          </Suspense>
          
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

        {/* Integrations: CRM, webhooks, external providers, API */}
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
                      Show advanced options for CRM sync, API management, and external integrations
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
            defaultValue={["external-data"]} 
            className="space-y-4"
          >
            {/* External Database Connections - Always visible */}
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
                <Suspense fallback={<SettingsSkeleton />}>
                  <ExternalDataProviders />
                </Suspense>
              </AccordionContent>
            </AccordionItem>

            {/* Advanced sections - Admin only and conditionally rendered */}
            {isAdmin && showAdvanced && (
              <>
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
                <Suspense fallback={<SettingsSkeleton />}>
                  <ServiceHealthStatus />
                  <EnrichmentProviderSetup />
                  <RateLimitSettings />
                  <APIKeyManager />
                </Suspense>
              </AccordionContent>
                </AccordionItem>

                {/* External Integrations */}
                <AccordionItem value="integrations-section" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <p className="font-semibold">CRM & External Integrations</p>
                        <p className="text-sm text-muted-foreground">CRM connectors and webhooks</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <Suspense fallback={<SettingsSkeleton />}>
                      <AIProviderSettings />
                      <IntegrationHealthDashboard />
                      <IntegrationCredentialManager />
                      <IntegrationManager />
                      {effectiveOrgId && <CRMSyncHistory orgId={effectiveOrgId} />}
                      <CampaignExportHistory />
                      <WebhookLogViewer />
                      <ZapierIntegration />
                    <ClayIncomingWebhooks />
                    </Suspense>
                  </AccordionContent>
                </AccordionItem>
              </>
            )}
          </Accordion>

          {/* Ad Platform Conversion Tracking */}
          <Suspense fallback={<SettingsSkeleton />}>
            <AdPlatformAPISettings />
          </Suspense>
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
          <Suspense fallback={<SettingsSkeleton />}>
            <ExportHistory />
          </Suspense>
        </TabsContent>
      </Tabs>

    </div>
  );
}