import { useState } from 'react';
import { HelpCircle, Search as SearchIcon, Video } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { HelpSearch } from './HelpSearch';
import { HelpVideoLibrary } from './HelpVideoLibrary';
import { ContextualHelp } from './ContextualHelp';
import { helpDatabase, videoTutorials } from './helpContent';
import { getContextualHelp, getPageTitle } from './helpUtils';

interface HelpPanelProps {
  currentPath?: string;
}

export function HelpPanel({ currentPath = '/' }: HelpPanelProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('browse');

  const contextualHelp = getContextualHelp(helpDatabase, currentPath);
  const pageTitle = getPageTitle(currentPath);

  const handleContextualItemClick = (itemId: string) => {
    setActiveTab('browse');
    setExpandedItem(itemId);
  };

  const groupedHelp = helpDatabase.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof helpDatabase>);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Help & Documentation</SheetTitle>
          <SheetDescription>
            Find answers, tutorials, and guides for {pageTitle}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col mt-4">
          {contextualHelp.length > 0 && activeTab === 'browse' && (
            <div className="mb-4">
              <ContextualHelp
                helpItems={contextualHelp}
                onItemClick={handleContextualItemClick}
              />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="browse" className="flex items-center gap-2">
                Browse Topics
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4" />
                Search
              </TabsTrigger>
              {videoTutorials.length > 0 && (
                <TabsTrigger value="videos" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Videos
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="browse" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  {Object.entries(groupedHelp).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <Collapsible
                            key={item.id}
                            open={expandedItem === item.id}
                            onOpenChange={(open) =>
                              setExpandedItem(open ? item.id : null)
                            }
                          >
                            <CollapsibleTrigger asChild>
                              <div className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm mb-1">
                                      {item.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {item.description}
                                    </p>
                                  </div>
                                  {item.videoUrl && (
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                      <Video className="h-3 w-3 mr-1" />
                                      Video
                                    </Badge>
                                  )}
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
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="search" className="flex-1 overflow-hidden mt-4">
              <HelpSearch helpItems={helpDatabase} />
            </TabsContent>

            {videoTutorials.length > 0 && (
              <TabsContent value="videos" className="flex-1 overflow-hidden mt-4">
                <HelpVideoLibrary />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
