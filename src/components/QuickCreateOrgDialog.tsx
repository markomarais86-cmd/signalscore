import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface QuickCreateOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (orgId: string) => void;
}

export function QuickCreateOrgDialog({ open, onOpenChange, onSuccess }: QuickCreateOrgDialogProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [linkToParent, setLinkToParent] = useState(true);
  const { userProfile } = useAuth();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsCreating(true);

    // If linking to parent, use the current user's org as the parent (data source)
    const parentOrgId = linkToParent ? userProfile?.org_id : null;

    const { data, error } = await supabase
      .from('organizations')
      .insert({ 
        name: trimmed, 
        status: 'active',
        ...(parentOrgId ? { parent_org_id: parentOrgId } : {})
      } as any)
      .select('id')
      .single();

    setIsCreating(false);

    if (error) {
      toast.error('Failed to create organization', { description: error.message });
      return;
    }

    toast.success(`"${trimmed}" created`, {
      description: parentOrgId ? 'Linked to parent data source' : 'Standalone organization',
    });
    setName('');
    onOpenChange(false);
    onSuccess(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New Organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ninety One Life"
              className="mt-1.5"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="link-parent" className="text-sm font-medium">Share parent data</Label>
              <p className="text-xs text-muted-foreground">
                Use your org's accounts & leads as the data source
              </p>
            </div>
            <Switch
              id="link-parent"
              checked={linkToParent}
              onCheckedChange={setLinkToParent}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
