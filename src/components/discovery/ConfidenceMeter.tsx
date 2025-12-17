import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfidenceMeterProps {
  confidence: number;
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceMeter({ confidence, reason, size = 'md' }: ConfidenceMeterProps) {
  // Determine color based on confidence level
  const getColorClasses = () => {
    if (confidence >= 90) return { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-500/20' };
    if (confidence >= 70) return { bg: 'bg-blue-500', text: 'text-blue-600', ring: 'ring-blue-500/20' };
    if (confidence >= 50) return { bg: 'bg-yellow-500', text: 'text-yellow-600', ring: 'ring-yellow-500/20' };
    return { bg: 'bg-orange-500', text: 'text-orange-600', ring: 'ring-orange-500/20' };
  };

  const getLabel = () => {
    if (confidence >= 90) return 'Excellent';
    if (confidence >= 70) return 'Good';
    if (confidence >= 50) return 'Fair';
    return 'Low';
  };

  const colors = getColorClasses();
  
  const sizeClasses = {
    sm: { wrapper: 'w-12 h-12', text: 'text-xs', label: 'text-[10px]' },
    md: { wrapper: 'w-14 h-14', text: 'text-sm', label: 'text-[10px]' },
    lg: { wrapper: 'w-16 h-16', text: 'text-base', label: 'text-xs' }
  };

  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 5 : 6;
  const radius = size === 'sm' ? 18 : size === 'md' ? 20 : 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  const meter = (
    <div className={cn(
      'relative flex items-center justify-center',
      sizeClasses[size].wrapper
    )}>
      {/* Background circle */}
      <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(colors.bg.replace('bg-', 'text-'))}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="flex flex-col items-center justify-center z-10">
        <span className={cn('font-bold', sizeClasses[size].text, colors.text)}>
          {confidence}%
        </span>
        <span className={cn('font-medium text-muted-foreground', sizeClasses[size].label)}>
          {getLabel()}
        </span>
      </div>
    </div>
  );

  if (reason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {meter}
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return meter;
}
