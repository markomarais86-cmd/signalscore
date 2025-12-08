import React from 'react';
import { Lightbulb, Sparkles, Clock, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Suggestion {
  type: 'template' | 'frequent' | 'preference';
  text: string;
  description: string;
  action: string;
  parameters?: Record<string, any>;
  confidence: number;
}

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  className?: string;
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  template: Star,
  frequent: Clock,
  preference: Sparkles,
};

const SUGGESTION_COLORS: Record<string, string> = {
  template: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  frequent: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  preference: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

export function SmartSuggestions({ suggestions, onSelect, className }: SmartSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lightbulb className="h-3 w-3" />
        <span>Suggestions based on your activity</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => {
          const Icon = SUGGESTION_ICONS[suggestion.type] || Sparkles;
          const colorClass = SUGGESTION_COLORS[suggestion.type] || SUGGESTION_COLORS.preference;
          
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className={cn(
                'h-auto py-2 px-3 text-left justify-start gap-2 group hover:shadow-sm transition-all',
                colorClass
              )}
              onClick={() => onSelect(suggestion)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {suggestion.text}
                </span>
                {suggestion.description && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                    {suggestion.description}
                  </span>
                )}
              </div>
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onSelect: (suggestion: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onSelect }: SuggestionCardProps) {
  const Icon = SUGGESTION_ICONS[suggestion.type] || Sparkles;
  
  return (
    <button
      onClick={() => onSelect(suggestion)}
      className="w-full p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left group"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-md',
          SUGGESTION_COLORS[suggestion.type] || SUGGESTION_COLORS.preference
        )}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{suggestion.text}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {Math.round(suggestion.confidence * 100)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {suggestion.description}
          </p>
        </div>
        
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </button>
  );
}

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  title?: string;
  emptyMessage?: string;
}

export function SuggestionsList({ 
  suggestions, 
  onSelect, 
  title = 'Suggested Actions',
  emptyMessage = 'No suggestions yet. Start using the AI chat to get personalized suggestions!'
}: SuggestionsListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard 
              key={index} 
              suggestion={suggestion} 
              onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
