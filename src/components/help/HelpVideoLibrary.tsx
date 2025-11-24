import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpVideoCard } from './HelpVideoCard';
import { videoTutorials } from './helpContent';

export function HelpVideoLibrary() {
  const categories = Array.from(
    new Set(videoTutorials.map((v) => v.category))
  );

  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredVideos =
    activeCategory === 'all'
      ? videoTutorials
      : videoTutorials.filter((v) => v.category === activeCategory);

  return (
    <div className="space-y-4">
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all">All Videos</TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
              {filteredVideos.map((video) => (
                <HelpVideoCard
                  key={video.id}
                  id={video.id}
                  title={video.title}
                  description={video.description}
                  duration={video.duration}
                  category={video.category}
                  videoUrl={video.videoUrl}
                  thumbnail={video.thumbnail}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
