import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import IntegrationManager from "@/components/settings/IntegrationManager";
import DataMapping from "@/components/settings/DataMapping";
import ScoringConfiguration from "@/components/settings/ScoringConfiguration";
import BenchmarkSettings from "@/components/settings/BenchmarkSettings";
import AIAgentSettings from "@/components/settings/AIAgentSettings";
import { FeatureToggles } from "@/components/settings/FeatureToggles";
import { AccountExclusions } from "@/components/settings/AccountExclusions";
import { ZapierIntegration } from "@/components/settings/ZapierIntegration";
import { APIKeyManager } from "@/components/settings/APIKeyManager";
import { ExternalDataProviders } from "@/components/settings/ExternalDataProviders";
import { RateLimitSettings } from "@/components/settings/RateLimitSettings";
import { AutomationSettings } from "@/components/settings/AutomationSettings";
import { ZapierWebhookManager } from "@/components/settings/ZapierWebhookManager";
import { DuplicateAccountMerger } from "@/components/settings/DuplicateAccountMerger";
import { FirmographicEnrichmentCard } from "@/components/settings/FirmographicEnrichmentCard";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  last_active?: string;
}

interface Integration {
  id: string;
  name: string;
  type: 'crm' | 'email' | 'webhook';
  status: 'connected' | 'disconnected' | 'error';
  last_sync?: string;
  config: any;
}

interface NotificationSetting {
  id: string;
  type: 'new_high_score' | 'data_quality' | 'weekly_report' | 'system';
  label: string;
  description: string;
  email: boolean;
  in_app: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(false);
  
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user' | 'viewer'>('user');
  
  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string; key: string; created_at: string; last_used?: string }[]>([]);
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationSetting[]>([]);
  
  const { userProfile, user } = useAuth();
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

      // Load mock data for demo
      setTeamMembers([
        {
          id: '1',
          email: 'alice@company.com',
          full_name: 'Alice Johnson',
          role: 'admin',
          status: 'active',
          last_active: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          email: 'bob@company.com',
          full_name: 'Bob Smith',
          role: 'user',
          status: 'active',
          last_active: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ]);

      setIntegrations([
        {
          id: '1',
          name: 'Salesforce',
          type: 'crm',
          status: 'connected',
          last_sync: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          config: { instance_url: 'https://company.salesforce.com' }
        },
        {
          id: '2',
          name: 'HubSpot',
          type: 'crm',
          status: 'disconnected',
          config: {}
        }
      ]);

      setApiKeys([
        {
          id: '1',
          name: 'Production API',
          key: 'sk_live_1234567890abcdef',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          last_used: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }
      ]);

      setNotifications([
        {
          id: '1',
          type: 'new_high_score',
          label: 'High-Score Leads',
          description: 'Get notified when leads score above 80',
          email: true,
          in_app: true
        },
        {
          id: '2',
          type: 'data_quality',
          label: 'Data Quality Issues',
          description: 'Alerts for missing or incomplete data',
          email: true,
          in_app: false
        },
        {
          id: '3',
          type: 'weekly_report',
          label: 'Weekly Reports',
          description: 'Summary of pipeline activity and performance',
          email: false,
          in_app: true
        }
      ]);

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

  const inviteTeamMember = async () => {
    if (!inviteEmail) return;
    
    try {
      // This would send an invitation email
      const newMember: TeamMember = {
        id: Date.now().toString(),
        email: inviteEmail,
        role: inviteRole,
        status: 'pending'
      };
      
      setTeamMembers(prev => [...prev, newMember]);
      setInviteEmail('');
      setInviteRole('user');
      
      toast({ title: "Success", description: "Invitation sent successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive"
      });
    }
  };

  const generateApiKey = async () => {
    try {
      const newKey = {
        id: Date.now().toString(),
        name: `API Key ${apiKeys.length + 1}`,
        key: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
        created_at: new Date().toISOString()
      };
      
      setApiKeys(prev => [...prev, newKey]);
      toast({ title: "Success", description: "API key generated successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate API key",
        variant: "destructive"
      });
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied", description: "API key copied to clipboard" });
  };

  const updateNotificationSetting = (id: string, field: 'email' | 'in_app', value: boolean) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, [field]: value } : n
    ));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, team, and application preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-12">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Labs
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Sources
          </TabsTrigger>
          <TabsTrigger value="zapier" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Zapier
          </TabsTrigger>
          <TabsTrigger value="data-mapping" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Data Mapping
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Scoring
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Benchmarks
          </TabsTrigger>
          <TabsTrigger value="ai-agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Agents
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Exclusions
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API
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
                <Input id="orgName" defaultValue="Acme Corporation" />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue="UTC">
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

        {/* Feature Toggles */}
        <TabsContent value="features" className="space-y-6">
          <FeatureToggles />
        </TabsContent>

        {/* Automation Settings */}
        <TabsContent value="automation" className="space-y-6">
          <AutomationSettings />
        </TabsContent>

        {/* Team Management */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage team access and permissions</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>Send an invitation to join your organization</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="inviteEmail">Email Address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="inviteRole">Role</Label>
                        <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer - Read only access</SelectItem>
                            <SelectItem value="user">User - Standard access</SelectItem>
                            <SelectItem value="admin">Admin - Full access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={inviteTeamMember}>Send Invitation</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
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
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Sources (External Databases) */}
        <TabsContent value="integrations" className="space-y-6">
          <FirmographicEnrichmentCard />
          <ExternalDataProviders />
          <RateLimitSettings />
          <IntegrationManager />
          <APIKeyManager />
        </TabsContent>

        {/* Zapier Integration */}
        <TabsContent value="zapier" className="space-y-6">
          <ZapierWebhookManager />
          <ZapierIntegration />
        </TabsContent>

        {/* Data Mapping */}
              <TabsContent value="data-mapping" className="space-y-6">
                <DuplicateAccountMerger />
                <DataMapping />
              </TabsContent>

        {/* Scoring Configuration */}
        <TabsContent value="scoring" className="space-y-6">
          <ScoringConfiguration />
        </TabsContent>

        {/* Benchmarks */}
        <TabsContent value="benchmarks" className="space-y-6">
          <BenchmarkSettings />
        </TabsContent>

        {/* AI Agents */}
        <TabsContent value="ai-agents" className="space-y-6">
          <AIAgentSettings />
        </TabsContent>

        {/* Exclusions */}
        <TabsContent value="exclusions" className="space-y-6">
          <AccountExclusions />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified about important events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {notifications.map((notification) => (
                  <div key={notification.id} className="flex items-center justify-between py-4 border-b">
                    <div className="flex-1">
                      <h4 className="font-medium">{notification.label}</h4>
                      <p className="text-sm text-muted-foreground">{notification.description}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Switch
                          checked={notification.email}
                          onCheckedChange={(checked) => updateNotificationSetting(notification.id, 'email', checked)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <Switch
                          checked={notification.in_app}
                          onCheckedChange={(checked) => updateNotificationSetting(notification.id, 'in_app', checked)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Management */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage API keys for programmatic access</CardDescription>
                </div>
                <Button onClick={generateApiKey}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{apiKey.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {showApiKey[apiKey.id] ? apiKey.key : '•'.repeat(20)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowApiKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                        >
                          {showApiKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyApiKey(apiKey.key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(apiKey.created_at).toLocaleDateString()}
                        {apiKey.last_used && ` • Last used: ${new Date(apiKey.last_used).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>Access documentation and rate limits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Rate Limits</h4>
                  <p className="text-sm text-muted-foreground mb-2">1000 requests per hour</p>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full w-1/3"></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">332 / 1000 requests used</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Documentation</h4>
                  <p className="text-sm text-muted-foreground mb-2">API reference and examples</p>
                  <Button variant="outline" size="sm">View Docs</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-6 bg-primary/5 rounded-lg">
                <div>
                  <h3 className="text-lg font-semibold">Professional Plan</h3>
                  <p className="text-muted-foreground">$99/month • Billed monthly</p>
                  <p className="text-sm text-muted-foreground mt-1">Next billing: Jan 15, 2024</p>
                </div>
                <div className="text-right">
                  <Button variant="outline">Change Plan</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>Current period usage and limits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium">Accounts</h4>
                  <p className="text-2xl font-bold">2,847</p>
                  <p className="text-sm text-muted-foreground">of 10,000 limit</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium">API Calls</h4>
                  <p className="text-2xl font-bold">15,342</p>
                  <p className="text-sm text-muted-foreground">of 100,000 limit</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium">Team Members</h4>
                  <p className="text-2xl font-bold">5</p>
                  <p className="text-sm text-muted-foreground">of 10 limit</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>Download invoices and view payment history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { date: '2024-01-01', amount: '$99.00', status: 'Paid' },
                  { date: '2023-12-01', amount: '$99.00', status: 'Paid' },
                  { date: '2023-11-01', amount: '$99.00', status: 'Paid' }
                ].map((invoice, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{invoice.date}</p>
                      <p className="text-sm text-muted-foreground">{invoice.amount}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{invoice.status}</Badge>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
      </Tabs>
    </div>
  );
}