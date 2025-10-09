import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Loader2 } from 'lucide-react';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent?: () => void;
}

export function InviteUserModal({ open, onOpenChange, onInviteSent }: InviteUserModalProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email || !userProfile) return;

    setLoading(true);
    try {
      // Generate invitation token
      const { data: tokenData, error: tokenError } = await supabase.rpc(
        'generate_invitation_token'
      );

      if (tokenError) throw tokenError;

      const token = tokenData as string;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation record
      const { error: inviteError } = await supabase.from('invitations').insert({
        org_id: userProfile.org_id,
        email: email.toLowerCase(),
        invited_by: userProfile.user_id,
        role,
        token,
        expires_at: expiresAt.toISOString(),
      });

      if (inviteError) throw inviteError;

      // Send invitation email
      const inviteUrl = `${window.location.origin}/auth?invite=${token}`;
      
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: email.toLowerCase(),
          inviteUrl,
          orgName: 'LaunchPulse', // You can fetch org name if needed
        },
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
        // Don't fail the whole operation if email fails
        toast({
          title: 'Invitation Created',
          description: 'Invitation created but email may not have been sent. Share the link manually.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Invitation Sent',
          description: `Invitation email sent to ${email}`,
        });
      }

      setEmail('');
      setRole('user');
      onInviteSent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They'll receive an email with instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')}>
              <SelectTrigger id="role" disabled={loading}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Admins can manage team members and settings
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!email || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
