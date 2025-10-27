import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building, Mail, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrganizationDialog({ open, onOpenChange, onSuccess }: CreateOrganizationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orgName: '',
    adminEmail: '',
    adminFullName: '',
  });

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.orgName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!validateEmail(formData.adminEmail)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.adminFullName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Admin full name is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: formData.orgName })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Generate invitation token
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_invitation_token');
      
      if (tokenError) throw tokenError;
      
      const token = tokenData as string;

      // 3. Create invitation for org admin
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const { error: inviteError } = await supabase.from('invitations').insert({
        org_id: org.id,
        email: formData.adminEmail,
        role: 'org_admin',
        token: token,
        expires_at: expiresAt.toISOString(),
        invited_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (inviteError) throw inviteError;

      // 4. Send invitation email via edge function
      const inviteUrl = `${window.location.origin}/auth?invite=${token}`;
      
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: formData.adminEmail,
          inviteUrl: inviteUrl,
          orgName: formData.orgName,
          inviterName: formData.adminFullName,
        },
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
        toast({
          title: 'Organization Created',
          description: 'Organization created but email failed to send. Please manually share the invitation link.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Success!',
          description: `Organization "${formData.orgName}" created and invitation sent to ${formData.adminEmail}`,
        });
      }

      // Reset form
      setFormData({
        orgName: '',
        adminEmail: '',
        adminFullName: '',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create organization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Set up a new customer organization and invite their admin
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <div className="relative">
              <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="orgName"
                placeholder="Acme Corporation"
                className="pl-10"
                value={formData.orgName}
                onChange={(e) => setFormData((prev) => ({ ...prev, orgName: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminFullName">Admin Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="adminFullName"
                placeholder="John Doe"
                className="pl-10"
                value={formData.adminFullName}
                onChange={(e) => setFormData((prev) => ({ ...prev, adminFullName: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@acme.com"
                className="pl-10"
                value={formData.adminEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, adminEmail: e.target.value }))}
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              An invitation email will be sent to this address
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
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
      </DialogContent>
    </Dialog>
  );
}
