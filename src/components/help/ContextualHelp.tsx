import { Lightbulb, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpItem } from './helpContent';
import { addToRecentHelp } from './helpUtils';

interface ContextualHelpProps {
  helpItems: HelpItem[];
  onItemClick: (itemId: string) => void;
}

export function ContextualHelp({ helpItems, onItemClick }: ContextualHelpProps) {
  if (helpItems.length === 0) {
    return null;
  }

  const handleItemClick = (itemId: string) => {
    addToRecentHelp(itemId);
    onItemClick(itemId);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Relevant to this page
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {helpItems.slice(0, 4).map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className="w-full justify-start h-auto py-2 px-3 text-left"
            onClick={() => handleItemClick(item.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-1">{item.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            </div>
            <ExternalLink className="h-3 w-3 ml-2 shrink-0 text-muted-foreground" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
