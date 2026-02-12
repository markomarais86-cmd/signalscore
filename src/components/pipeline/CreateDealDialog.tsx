import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDeal } from '@/hooks/use-opportunities';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateDealDialog({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedClose, setExpectedClose] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [source, setSource] = useState('');
  const createDeal = useCreateDeal();

  const handleSubmit = () => {
    if (!name.trim()) return;
    createDeal.mutate({
      name: name.trim(),
      amount: amount ? parseFloat(amount) : undefined,
      expected_close_date: expectedClose || undefined,
      owner_name: ownerName || undefined,
      source: source || undefined,
    }, {
      onSuccess: () => {
        setName('');
        setAmount('');
        setExpectedClose('');
        setOwnerName('');
        setSource('');
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
          <DialogDescription>Add a new opportunity to the pipeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Deal Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp - Enterprise" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50000" />
            </div>
            <div>
              <Label>Expected Close</Label>
              <Input type="date" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Owner</Label>
              <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <Label>Source</Label>
              <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Inbound, Outbound" />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={!name.trim() || createDeal.isPending} className="w-full">
            {createDeal.isPending ? 'Creating...' : 'Create Deal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
