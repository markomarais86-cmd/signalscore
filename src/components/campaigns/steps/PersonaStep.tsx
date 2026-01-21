import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ICPProfile } from "../hooks/useCampaignState";

interface PersonaStepProps {
  activeICP: ICPProfile | null;
  selectedTitles: string[];
  setSelectedTitles: (titles: string[]) => void;
  selectedSeniority: string[];
  setSelectedSeniority: (seniority: string[]) => void;
  selectedDepartments: string[];
  setSelectedDepartments: (departments: string[]) => void;
}

export function PersonaStep({
  activeICP,
  selectedTitles,
  setSelectedTitles,
  selectedSeniority,
  setSelectedSeniority,
  selectedDepartments,
  setSelectedDepartments
}: PersonaStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Persona Selection</h3>
        <p className="text-sm text-muted-foreground">Refine the personas based on your ICP (pre-populated)</p>
      </div>

      <div>
        <Label className="mb-3 block">Job Titles</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {(activeICP?.persona_job_titles || []).map(title => (
            <div key={title} className="flex items-center space-x-2">
              <Checkbox
                id={title}
                checked={selectedTitles.includes(title)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedTitles([...selectedTitles, title]);
                  } else {
                    setSelectedTitles(selectedTitles.filter(t => t !== title));
                  }
                }}
              />
              <Label htmlFor={title}>{title}</Label>
            </div>
          ))}
          {(!activeICP?.persona_job_titles || activeICP.persona_job_titles.length === 0) && (
            <p className="text-sm text-muted-foreground">No job titles defined in ICP</p>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Seniority Levels</Label>
        <div className="space-y-2">
          {(activeICP?.persona_seniority_levels || []).map(level => (
            <div key={level} className="flex items-center space-x-2">
              <Checkbox
                id={level}
                checked={selectedSeniority.includes(level)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedSeniority([...selectedSeniority, level]);
                  } else {
                    setSelectedSeniority(selectedSeniority.filter(s => s !== level));
                  }
                }}
              />
              <Label htmlFor={level}>{level}</Label>
            </div>
          ))}
          {(!activeICP?.persona_seniority_levels || activeICP.persona_seniority_levels.length === 0) && (
            <p className="text-sm text-muted-foreground">No seniority levels defined in ICP</p>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Departments</Label>
        <div className="space-y-2">
          {(activeICP?.persona_departments || []).map(dept => (
            <div key={dept} className="flex items-center space-x-2">
              <Checkbox
                id={dept}
                checked={selectedDepartments.includes(dept)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedDepartments([...selectedDepartments, dept]);
                  } else {
                    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                  }
                }}
              />
              <Label htmlFor={dept}>{dept}</Label>
            </div>
          ))}
          {(!activeICP?.persona_departments || activeICP.persona_departments.length === 0) && (
            <p className="text-sm text-muted-foreground">No departments defined in ICP</p>
          )}
        </div>
      </div>
    </div>
  );
}
