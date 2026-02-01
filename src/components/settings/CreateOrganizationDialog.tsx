import { useActionState, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building, Mail, User, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormState, initialFormState, validateEmail, getFormValue, createErrorState, createFormState } from '@/lib/form-actions';
import { getInviteUrl } from '@/lib/url-utils';

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CreateOrgState extends FormState {
  invitationUrl?: string;
}

export function CreateOrganizationDialog({ open, onOpenChange, onSuccess }: CreateOrganizationDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const createOrgAction = async (prevState: CreateOrgState, formData: FormData): Promise<CreateOrgState> => {
    const orgName = getFormValue(formData, 'orgName');
    const adminEmail = getFormValue(formData, 'adminEmail');
    const adminFullName = getFormValue(formData, 'adminFullName');

    if (!orgName.trim()) {
      return createErrorState('Organization name is required');
    }

    if (!validateEmail(adminEmail)) {
      return createErrorState('Please enter a valid email address');
    }

    if (!adminFullName.trim()) {
      return createErrorState('Admin full name is required');
    }

    try {
      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Generate invitation token
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_invitation_token');
      if (tokenError) throw tokenError;
      
      const token = tokenData as string;

      // 3. Create invitation for org admin
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: inviteError } = await supabase.from('invitations').insert({
        org_id: org.id,
        email: adminEmail,
        role: 'org_admin',
        token: token,
        expires_at: expiresAt.toISOString(),
        invited_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (inviteError) throw inviteError;

      // 4. Send invitation email using production URL
      const inviteUrl = getInviteUrl(token);
      
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: adminEmail,
          inviteUrl: inviteUrl,
          orgName: orgName,
          inviterName: adminFullName,
        },
      });

      if (emailError) {
        toast({
          title: 'Organization Created',
          description: 'Copy the invitation link below to share with the admin.',
        });
      } else {
        toast({
          title: 'Success!',
          description: `Organization "${orgName}" created and invitation sent to ${adminEmail}`,
        });
      }

      onSuccess();
      return { success: true, error: null, invitationUrl: inviteUrl };
    } catch (error: any) {
      console.error('Error creating organization:', error);
      return createErrorState(error.message || 'Failed to create organization');
    }
  };

  const [state, formAction, isPending] = useActionState(createOrgAction, { success: false, error: null } as CreateOrgState);

  const copyToClipboard = () => {
    if (state.invitationUrl) {
      navigator.clipboard.writeText(state.invitationUrl);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Invitation link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Set up a new customer organization and invite their admin
          </DialogDescription>
        </DialogHeader>

        {state.invitationUrl ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Organization created successfully! Share this invitation link with the admin:
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input value={state.invitationUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyToClipboard}>
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This link expires in 7 days</p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <div className="relative">
                <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="orgName"
                  name="orgName"
                  placeholder="Acme Corporation"
                  className="pl-10"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminFullName">Admin Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="adminFullName"
                  name="adminFullName"
                  placeholder="John Doe"
                  className="pl-10"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  placeholder="admin@acme.com"
                  className="pl-10"
                  disabled={isPending}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                An invitation email will be sent to this address
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Send Invitation'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
