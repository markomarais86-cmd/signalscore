import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/hooks/use-roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Shield, Users, Building, Search, RefreshCw, Plus, Power, PowerOff, Trash2, MoreVertical, UserCog, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/utils/format-numbers';
import { CreateOrganizationDialog } from '@/components/settings/CreateOrganizationDialog';
import { InvitationsManager } from '@/components/settings/InvitationsManager';
import { AuditLogViewer } from '@/components/platform-admin/AuditLogViewer';
import { PlatformMetrics } from '@/components/platform-admin/PlatformMetrics';
import { OrganizationCard } from '@/components/platform-admin/OrganizationCard';
import { OrganizationManagementDialog } from '@/components/platform-admin/OrganizationManagementDialog';
import { usePlatformAdmin } from '@/hooks/use-platform-admin';
import { FeatureToggles } from '@/components/settings/FeatureToggles';
import { OrganizationFeatureFlags } from '@/components/platform-admin/OrganizationFeatureFlags';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Organization {
  id: string;
  name: string;
  created_at: string;
  status: string;
  user_count: number;
  account_count: number;
  last_activity: string | null;
}

interface UserWithProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  org_name: string;
  org_id: string;
  profile_role: string;
  user_roles: string[];
  created_at: string;
}

export default function AdminDashboard() {
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizations, organizationMetrics, recentAudits, isLoading: metricsLoading } = usePlatformAdmin();
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [managingOrg, setManagingOrg] = useState<string | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<{ userId: string; email: string; newRole: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!rolesLoading && !isSuperAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isSuperAdmin, rolesLoading, navigate, toast]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAdminData();
      loadCurrentUser();
    }
  }, [isSuperAdmin]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser({ id: user.id });
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      await loadUsers();
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    // Use RPC function to get users with emails
    const { data: usersData, error: usersError } = await supabase.rpc('get_users_with_emails');

    if (usersError) {
      console.error('Error loading users:', usersError);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
      return;
    }

    if (!usersData) return;

    // Get user roles for each user
    const usersWithRoles = await Promise.all(
      usersData.map(async (userData: any) => {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user_id);

        return {
          user_id: userData.user_id,
          email: userData.email || 'N/A',
          full_name: userData.full_name,
          org_name: userData.org_name || 'Unknown',
          org_id: userData.org_id,
          profile_role: userData.profile_role,
          user_roles: roles?.map((r) => r.role) || [],
          created_at: userData.created_at,
        };
      })
    );

    setUsers(usersWithRoles);
  };

  const handleRoleChange = async (userId: string, newRole: 'super_admin' | 'org_admin' | 'user') => {
    try {
      // First delete all existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then insert the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;

      toast({
        title: 'Role Updated',
        description: 'User role has been updated successfully.',
      });

      setRoleChangeUser(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const confirmRoleChange = () => {
    if (roleChangeUser) {
      handleRoleChange(roleChangeUser.userId, roleChangeUser.newRole as 'super_admin' | 'org_admin' | 'user');
    }
  };

  const handleActivateOrg = async (orgId: string) => {
    try {
      const { error } = await supabase.rpc('activate_organization', { org_id_param: orgId });
      if (error) throw error;

      toast({
        title: 'Organization Activated',
        description: 'Organization has been activated successfully.',
      });

      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeactivateOrg = async (orgId: string) => {
    try {
      const { error } = await supabase.rpc('deactivate_organization', { org_id_param: orgId });
      if (error) throw error;

      toast({
        title: 'Organization Deactivated',
        description: 'Organization has been deactivated successfully.',
      });

      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrgId) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', deleteOrgId);

      if (error) throw error;

      toast({
        title: 'Organization Deleted',
        description: 'Organization has been deleted successfully.',
      });

      setDeleteOrgId(null);
      loadAdminData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.org_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOrg = selectedOrgFilter === 'all' || user.org_id === selectedOrgFilter;

    return matchesSearch && matchesOrg;
  });

  if (rolesLoading || loading || metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Platform Admin</h1>
            <p className="text-sm text-muted-foreground">
              Manage organizations, users, and platform settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateOrgDialog(true)} variant="default">
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
          <Button onClick={loadAdminData} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Platform Metrics */}
      <PlatformMetrics organizations={organizationMetrics} />

      {/* Tabbed Content */}
      <Tabs defaultValue="organizations-overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organizations-overview">Organizations Overview</TabsTrigger>
          <TabsTrigger value="organizations-table">Organizations Table</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations-overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizationMetrics.map((org) => (
              <OrganizationCard
                key={org.id}
                org={org}
                onManage={(orgId) => setManagingOrg(orgId)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="organizations-table">
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>All customer organizations in the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Accounts</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizationMetrics.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                          {org.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{org.total_users}</TableCell>
                      <TableCell>{formatNumber(org.total_accounts)}</TableCell>
                      <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setManagingOrg(org.id)}>
                              Manage
                            </DropdownMenuItem>
                            {org.status === 'active' ? (
                              <DropdownMenuItem onClick={() => handleDeactivateOrg(org.id)}>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleActivateOrg(org.id)}>
                                <Power className="h-4 w-4 mr-2" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => setDeleteOrgId(org.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>All users across all organizations</CardDescription>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedOrgFilter} onValueChange={setSelectedOrgFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by org" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizationMetrics.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || 'N/A'}</TableCell>
                  <TableCell>{user.org_name}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {user.user_roles.includes('super_admin') && (
                        <Badge variant="destructive">Super Admin</Badge>
                      )}
                      {user.user_roles.includes('org_admin') && (
                        <Badge variant="default">Org Admin</Badge>
                      )}
                      {user.user_roles.length === 0 && (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={user.user_id === currentUser?.id}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setRoleChangeUser({ 
                            userId: user.user_id, 
                            email: user.email, 
                            newRole: 'super_admin' 
                          })}
                          disabled={user.user_roles.includes('super_admin')}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Make Super Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRoleChangeUser({ 
                            userId: user.user_id, 
                            email: user.email, 
                            newRole: 'org_admin' 
                          })}
                          disabled={user.user_roles.includes('org_admin')}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Make Org Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRoleChangeUser({ 
                            userId: user.user_id, 
                            email: user.email, 
                            newRole: 'user' 
                          })}
                          disabled={user.user_roles.length === 0}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Make User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <InvitationsManager />
        </TabsContent>

        <TabsContent value="feature-flags">
            <div className="space-y-6">
              {/* Per-Organization Feature Flags */}
              <OrganizationFeatureFlags organizations={organizationMetrics} />
              
              {/* Current Org Feature Flags (legacy) */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Organization Feature Flags</CardTitle>
                  <CardDescription>Enable or disable features for your own organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <FeatureToggles />
                </CardContent>
              </Card>
            </div>
        </TabsContent>

        <TabsContent value="audit">
          {recentAudits && <AuditLogViewer logs={recentAudits} />}
        </TabsContent>
      </Tabs>

      {/* Organization Management Dialog */}
      {managingOrg && (
        <OrganizationManagementDialog
          org={organizationMetrics.find(o => o.id === managingOrg)!}
          open={!!managingOrg}
          onOpenChange={(open) => !open && setManagingOrg(null)}
          onUpdate={() => window.location.reload()}
        />
      )}

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
        onSuccess={loadAdminData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOrgId !== null} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the organization
              and all associated data including users, accounts, and scores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={roleChangeUser !== null} onOpenChange={() => setRoleChangeUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the role of <strong>{roleChangeUser?.email}</strong> to <strong>{roleChangeUser?.newRole.replace('_', ' ')}</strong>?
              {roleChangeUser?.newRole === 'super_admin' && (
                <span className="block mt-2 text-destructive font-semibold">
                  ⚠️ Warning: This will grant full platform access including the ability to manage all organizations and users.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
