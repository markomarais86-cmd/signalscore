import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Target, Info, Lightbulb } from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { ICP_USE_CASES } from '@/constants/icp';

interface ICPWizardStep1Props {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
  errors?: Record<string, string>;
}

export function ICPWizardStep1({ formData, onUpdateFormData, errors }: ICPWizardStep1Props) {
  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      onUpdateFormData({
        tags: [...formData.tags, tag]
      });
    }
  };

  const removeTag = (index: number) => {
    onUpdateFormData({
      tags: formData.tags.filter((_, i) => i !== index)
    });
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (value) {
        addTag(value);
        e.currentTarget.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Basic Information</h2>
          <p className="text-muted-foreground">
            Define the core characteristics of your ideal customer profile
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Profile Details
            </CardTitle>
            <CardDescription>
              Basic information about this ICP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">ICP Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onUpdateFormData({ name: e.target.value })}
                placeholder="e.g., Enterprise SaaS Companies"
                className={errors?.name ? "border-destructive" : ""}
              />
              {errors?.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => onUpdateFormData({ description: e.target.value })}
                placeholder="Describe your ideal customer profile..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="use_case">Primary Use Case</Label>
              <Select 
                value={formData.use_case} 
                onValueChange={(value) => onUpdateFormData({ use_case: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a use case" />
                </SelectTrigger>
                <SelectContent>
                  {ICP_USE_CASES.map(useCase => (
                    <SelectItem key={useCase} value={useCase}>
                      {useCase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Organization & Tags
            </CardTitle>
            <CardDescription>
              Organize and categorize this ICP for better management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tags">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="cursor-pointer"
                    onClick={() => removeTag(index)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add tags (press Enter)"
                onKeyPress={handleTagKeyPress}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Press Enter to add tags. Click tags to remove them.
              </p>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: 'draft' | 'active' | 'archived') => onUpdateFormData({ status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft - Work in progress</SelectItem>
                  <SelectItem value="active">Active - Currently being used</SelectItem>
                  <SelectItem value="archived">Archived - No longer active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Choose a descriptive name that clearly identifies the customer segment</li>
            <li>• Include the target market and key characteristics in the name</li>
            <li>• Use tags to organize ICPs by campaign, vertical, or priority level</li>
            <li>• Keep descriptions focused on the business value and targeting strategy</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}