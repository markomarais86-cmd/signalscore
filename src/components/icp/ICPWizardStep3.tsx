import React, { useState, KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Crown, Building2, Target, Lightbulb, X } from 'lucide-react';
import { LaunchPulseMark } from '@/components/BrandLogo';
import { ICPFormData } from '@/types/icp';
import { 
  PERSONA_JOB_TITLES, 
  PERSONA_SENIORITY_LEVELS, 
  PERSONA_DEPARTMENTS, 
  PERSONA_DECISION_ROLES 
} from '@/constants/icp';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface ICPWizardStep3Props {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
}

export function ICPWizardStep3({ formData, onUpdateFormData }: ICPWizardStep3Props) {
  const [jobTitleInput, setJobTitleInput] = useState('');
  const { userProfile } = useAuth();

  // Fetch top job titles from user's leads using client-side aggregation
  const { data: topTitles } = useQuery({
    queryKey: ['top-lead-titles', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      
      // Fetch all titles and aggregate client-side (more reliable than RPC)
      const { data: allTitles, error } = await supabase
        .from('Leads')
        .select('title')
        .eq('org_id', userProfile.org_id)
        .not('title', 'is', null);
      
      if (error || !allTitles) {
        console.error('Error fetching titles:', error);
        return [];
      }
      
      // Aggregate and count titles
      const titleCounts: Record<string, number> = {};
      allTitles.forEach(row => {
        if (row.title) {
          titleCounts[row.title] = (titleCounts[row.title] || 0) + 1;
        }
      });
      
      // Return top 5 most common titles not already selected
      return Object.entries(titleCounts)
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(t => t.title)
        .filter(title => !formData.persona_job_titles.includes(title));
    },
    enabled: !!userProfile?.org_id,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const addToArray = (field: keyof ICPFormData, value: string) => {
    const currentArray = formData[field] as string[];
    const trimmedValue = value.trim();
    if (trimmedValue && !currentArray.includes(trimmedValue)) {
      onUpdateFormData({
        [field]: [...currentArray, trimmedValue]
      });
    }
  };

  const removeFromArray = (field: keyof ICPFormData, index: number) => {
    const currentArray = formData[field] as string[];
    onUpdateFormData({
      [field]: currentArray.filter((_, i) => i !== index)
    });
  };

  const handleJobTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && jobTitleInput.trim()) {
      e.preventDefault();
      addToArray('persona_job_titles', jobTitleInput);
      setJobTitleInput('');
    }
  };

  const clearArray = (field: keyof ICPFormData) => {
    onUpdateFormData({ [field]: [] });
  };

  const ClearButton = ({ field, count }: { field: keyof ICPFormData; count: number }) => {
    if (count === 0) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => clearArray(field)}
      >
        <X className="h-3 w-3 mr-1" />
        Clear ({count})
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Persona Targeting</h2>
          <p className="text-muted-foreground">
            Define the specific roles and decision-makers you want to reach
          </p>
        </div>
      </div>

      {/* Persona Suggestions from Leads */}
      {topTitles && topTitles.length > 0 && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <LaunchPulseMark className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong className="text-blue-900 dark:text-blue-100">We found these job titles in your leads:</strong>
            <div className="flex flex-wrap gap-2 mt-2">
              {topTitles.map(title => (
                <Badge 
                  key={title}
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                  onClick={() => addToArray('persona_job_titles', title)}
                >
                  + {title}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Job Titles & Roles
            </CardTitle>
            <CardDescription>
              Target specific job titles and functional roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Job Titles</Label>
                <ClearButton field="persona_job_titles" count={formData.persona_job_titles.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {formData.persona_job_titles.map((title, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('persona_job_titles', index)}>
                    {title} ×
                  </Badge>
                ))}
              </div>
              <Input
                value={jobTitleInput}
                onChange={(e) => setJobTitleInput(e.target.value)}
                onKeyDown={handleJobTitleKeyDown}
                placeholder="Type job title and press Enter (e.g., Storage Engineer, Database Manager)"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Matching uses "contains" logic - e.g., "Data" will match "Data Architect", "Database Manager", etc.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Departments</Label>
                <ClearButton field="persona_departments" count={formData.persona_departments.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.persona_departments.map((dept, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('persona_departments', index)}>
                    {dept} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('persona_departments', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add department" />
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_DEPARTMENTS.filter(dept => !formData.persona_departments.includes(dept)).map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Seniority & Decision Power
            </CardTitle>
            <CardDescription>
              Target by seniority level and decision-making authority
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Seniority Levels</Label>
                <ClearButton field="persona_seniority_levels" count={formData.persona_seniority_levels.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.persona_seniority_levels.map((level, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('persona_seniority_levels', index)}>
                    {level} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('persona_seniority_levels', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add seniority level" />
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_SENIORITY_LEVELS.filter(level => !formData.persona_seniority_levels.includes(level)).map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Decision-Making Roles</Label>
                <ClearButton field="persona_decision_roles" count={formData.persona_decision_roles.length} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.persona_decision_roles.map((role, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('persona_decision_roles', index)}>
                    {role} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => addToArray('persona_decision_roles', value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add decision role" />
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_DECISION_ROLES.filter(role => !formData.persona_decision_roles.includes(role)).map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Persona Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Persona Summary
          </CardTitle>
          <CardDescription>
            Overview of your target persona characteristics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Job Titles ({formData.persona_job_titles.length})</Label>
              <div className="text-sm text-muted-foreground">
                {formData.persona_job_titles.length > 0 
                  ? formData.persona_job_titles.slice(0, 2).join(', ') + (formData.persona_job_titles.length > 2 ? '...' : '')
                  : 'No titles selected'
                }
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Departments ({formData.persona_departments.length})</Label>
              <div className="text-sm text-muted-foreground">
                {formData.persona_departments.length > 0 
                  ? formData.persona_departments.slice(0, 2).join(', ') + (formData.persona_departments.length > 2 ? '...' : '')
                  : 'No departments selected'
                }
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Seniority ({formData.persona_seniority_levels.length})</Label>
              <div className="text-sm text-muted-foreground">
                {formData.persona_seniority_levels.length > 0 
                  ? formData.persona_seniority_levels.slice(0, 2).join(', ') + (formData.persona_seniority_levels.length > 2 ? '...' : '')
                  : 'No levels selected'
                }
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Decision Roles ({formData.persona_decision_roles.length})</Label>
              <div className="text-sm text-muted-foreground">
                {formData.persona_decision_roles.length > 0 
                  ? formData.persona_decision_roles.slice(0, 2).join(', ') + (formData.persona_decision_roles.length > 2 ? '...' : '')
                  : 'No roles selected'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Persona Targeting Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Focus on decision-makers and influencers who can advocate for your solution</li>
            <li>• Include both technical evaluators and business decision makers</li>
            <li>• Consider the buying committee - who else might be involved in decisions?</li>
            <li>• Match seniority levels to your solution's price point and complexity</li>
            <li>• Different departments may have different pain points and priorities</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}