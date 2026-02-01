import { useActionState, useState } from 'react';
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
import { FormState, initialFormState, validateEmail, getFormValue, createErrorState, createFormState } from '@/lib/form-actions';
import { getInviteUrl } from '@/lib/url-utils';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent?: () => void;
}

export function InviteUserModal({ open, onOpenChange, onInviteSent }: InviteUserModalProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [role, setRole] = useState<'user' | 'admin'>('user');

  const inviteAction = async (prevState: FormState, formData: FormData): Promise<FormState> => {
    const email = getFormValue(formData, 'email');
    
    if (!email || !validateEmail(email)) {
      return createErrorState('Please enter a valid email address');
    }
    
    if (!userProfile) {
      return createErrorState('User profile not found');
    }

    try {
      // Generate invitation token
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_invitation_token');
      if (tokenError) throw tokenError;

      const token = tokenData as string;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

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

      // Send invitation email using production URL for deliverability
      const inviteUrl = getInviteUrl(token);
      
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: email.toLowerCase(),
          inviteUrl,
          orgName: 'LaunchPulse',
        },
      });

      if (emailError) {
        toast({
          title: 'Invitation Created',
          description: 'Invitation created but email may not have been sent. Share the link manually.',
        });
      } else {
        toast({
          title: 'Invitation Sent',
          description: `Invitation email sent to ${email}`,
        });
      }

      setRole('user');
      onInviteSent?.();
      onOpenChange(false);
      
      return createFormState();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      return createErrorState(error.message || 'Failed to send invitation');
    }
  };

  const [state, formAction, isPending] = useActionState(inviteAction, initialFormState);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They'll receive an email with instructions.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <div className="grid gap-4 py-4">
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="colleague@company.com"
                disabled={isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')}>
                <SelectTrigger id="role" disabled={isPending}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
