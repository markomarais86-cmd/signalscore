import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSegments } from '@/hooks/use-segments';
import { Filter, Plus, Users, Trash2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function Segmentation() {
  const { segments, isLoading, createSegment, deleteSegment } = useSegments();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    query_config: {
      industries: [],
      revenue_ranges: [],
      geographies: [],
      score_min: 0,
    },
  });

  const handleCreateSegment = async () => {
    if (!newSegment.name) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a segment name',
        variant: 'destructive',
      });
      return;
    }

    await createSegment(newSegment);
    setNewSegment({
      name: '',
      description: '',
      query_config: { industries: [], revenue_ranges: [], geographies: [], score_min: 0 },
    });
    setIsCreating(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Advanced Segmentation</h1>
            <p className="text-muted-foreground mt-2">
              Create dynamic segments with multi-dimensional criteria
            </p>
          </div>
          <Button onClick={() => setIsCreating(!isCreating)}>
            <Plus className="h-4 w-4 mr-2" />
            New Segment
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Segment</CardTitle>
              <CardDescription>Define your segment criteria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Segment Name</Label>
                <Input
                  id="name"
                  placeholder="Enterprise SaaS Prospects"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="High-value enterprise accounts in SaaS..."
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Criteria</Label>
                <Card className="p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    <Filter className="h-4 w-4 inline mr-2" />
                    Advanced query builder coming soon...
                  </p>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateSegment}>Create Segment</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <Card key={segment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Users className="h-8 w-8 text-primary" />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSegment(segment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg">{segment.name}</CardTitle>
                <CardDescription>{segment.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Accounts</span>
                    <Badge variant="secondary">{segment.account_count}</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="w-full">
                    <Filter className="h-4 w-4 mr-1" />
                    View Accounts
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {segments.length === 0 && !isCreating && !isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No segments yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first segment to organize accounts
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
