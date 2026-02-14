import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ICPFieldWeight } from '@/types/icp';

interface ICPWeightControlProps {
  label: string;
  fieldKey: string;
  weight: ICPFieldWeight;
  onChange: (fieldKey: string, weight: ICPFieldWeight) => void;
}

export function ICPWeightControl({ label, fieldKey, weight, onChange }: ICPWeightControlProps) {
  const handleWeightChange = (value: number[]) => {
    onChange(fieldKey, { ...weight, value: value[0] });
  };

  const handleMandatoryChange = (checked: boolean) => {
    onChange(fieldKey, { ...weight, mandatory: checked, bonus: checked ? false : weight.bonus });
  };

  const handleBonusChange = (checked: boolean) => {
    onChange(fieldKey, { ...weight, bonus: checked, mandatory: checked ? false : weight.mandatory });
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Label className="text-xs font-medium truncate">{label}</Label>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            {weight.value}/10
          </Badge>
        </div>
        <Slider
          value={[weight.value]}
          min={1}
          max={10}
          step={1}
          onValueChange={handleWeightChange}
          className="w-full"
        />
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <label className="flex items-center gap-1 cursor-pointer">
          <Checkbox
            checked={weight.mandatory || false}
            onCheckedChange={(checked) => handleMandatoryChange(checked as boolean)}
            className="h-3 w-3"
          />
          <span className="text-[10px] text-muted-foreground">Required</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <Checkbox
            checked={weight.bonus || false}
            onCheckedChange={(checked) => handleBonusChange(checked as boolean)}
            className="h-3 w-3"
          />
          <span className="text-[10px] text-muted-foreground">Bonus</span>
        </label>
      </div>
    </div>
  );
}
