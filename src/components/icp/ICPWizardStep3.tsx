import React, { useState, KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Crown, Building2, Target, Lightbulb } from 'lucide-react';
import { ICPFormData } from '@/types/icp';
import { 
  PERSONA_JOB_TITLES, 
  PERSONA_SENIORITY_LEVELS, 
  PERSONA_DEPARTMENTS, 
  PERSONA_DECISION_ROLES 
} from '@/constants/icp';

interface ICPWizardStep3Props {
  formData: ICPFormData;
  onUpdateFormData: (updates: Partial<ICPFormData>) => void;
}

export function ICPWizardStep3({ formData, onUpdateFormData }: ICPWizardStep3Props) {
  const [jobTitleInput, setJobTitleInput] = useState('');

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
              <Label>Job Titles</Label>
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
              <Label>Departments</Label>
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
              <Label>Seniority Levels</Label>
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
              <Label>Decision-Making Roles</Label>
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