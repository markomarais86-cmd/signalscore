import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InviteUserModal } from './InviteUserModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, XCircle, RefreshCw, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export function InvitationsManager() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      loadInvitations();
    }
  }, [userProfile]);

  const loadInvitations = async () => {
    if (!userProfile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      // Get organization name for the email
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', userProfile?.org_id)
        .single();

      // Build invitation URL
      const inviteUrl = `https://launchpulse.io/auth?invite=${invitation.id}`;
      
      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: invitation.email,
          inviteUrl,
          orgName: org?.name || 'LaunchPulse'
        }
      });

      if (emailError) throw emailError;

      toast({
        title: 'Invitation Resent',
        description: `Invitation email has been resent to ${invitation.email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Invitation Cancelled',
        description: 'The invitation has been cancelled.',
      });

      loadInvitations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === 'accepted') {
      return <Badge variant="default">Accepted</Badge>;
    }
    if (status === 'expired' || new Date(expiresAt) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Invitations</CardTitle>
              <CardDescription>Manage pending and sent invitations</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadInvitations} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No invitations yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setInviteModalOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Send First Invitation
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell className="capitalize">{invitation.role}</TableCell>
                    <TableCell>{getStatusBadge(invitation.status, invitation.expires_at)}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation)}
                            disabled={resendingId === invitation.id}
                          >
                            {resendingId === invitation.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInviteSent={loadInvitations}
      />
    </>
  );
}
