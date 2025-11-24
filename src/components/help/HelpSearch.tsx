import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { HelpItem } from './helpContent';
import { searchHelpContent, addToRecentHelp } from './helpUtils';
import { HighlightedText } from './HighlightedText';

interface HelpSearchProps {
  helpItems: HelpItem[];
  onClose?: () => void;
}

export function HelpSearch({ helpItems, onClose }: HelpSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HelpItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (query.length >= 2) {
      const searchResults = searchHelpContent(helpItems, query);
      setResults(searchResults);
    } else {
      setResults([]);
    }
  }, [query, helpItems]);

  const handleItemClick = (itemId: string) => {
    setExpandedId(expandedId === itemId ? null : itemId);
    addToRecentHelp(itemId);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setExpandedId(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search help documentation..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
          autoFocus
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {query.length >= 2 && (
        <ScrollArea className="h-[400px]">
          {results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground px-1">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((item) => (
                <Collapsible
                  key={item.id}
                  open={expandedId === item.id}
                  onOpenChange={() => handleItemClick(item.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1">
                            <HighlightedText text={item.title} query={query} />
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            <HighlightedText text={item.description} query={query} />
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-4 rounded-lg border bg-muted/50 space-y-3">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="whitespace-pre-wrap text-sm">
                          {item.content}
                        </div>
                      </div>
                      {item.videoUrl && (
                        <div className="aspect-video rounded-lg overflow-hidden">
                          <iframe
                            src={item.videoUrl}
                            title={item.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {item.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.keywords.slice(0, 5).map((keyword) => (
                            <Badge
                              key={keyword}
                              variant="outline"
                              className="text-xs"
                            >
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">No results found</p>
              <p className="text-sm text-muted-foreground">
                Try different keywords or browse help topics
              </p>
            </div>
          )}
        </ScrollArea>
      )}

      {query.length < 2 && query.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Type at least 2 characters to search
        </p>
      )}
    </div>
  );
}
