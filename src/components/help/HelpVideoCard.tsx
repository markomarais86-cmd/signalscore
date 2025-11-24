import { useState } from 'react';
import { Play, Clock, Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  addToWatchLater,
  removeFromWatchLater,
  isInWatchLater,
} from './helpUtils';

interface HelpVideoCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  videoUrl: string;
  thumbnail: string;
}

export function HelpVideoCard({
  id,
  title,
  description,
  duration,
  category,
  videoUrl,
  thumbnail,
}: HelpVideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(isInWatchLater(id));

  const handleWatchLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      removeFromWatchLater(id);
      setIsSaved(false);
    } else {
      addToWatchLater(id);
      setIsSaved(true);
    }
  };

  return (
    <>
      <div
        className="group relative rounded-lg border bg-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setIsPlaying(true)}
      >
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Play className="h-8 w-8 text-primary-foreground ml-1" />
            </div>
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {duration}
            </Badge>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleWatchLater}
            >
              {isSaved ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="p-4">
          <Badge variant="outline" className="mb-2 text-xs">
            {category}
          </Badge>
          <h3 className="font-semibold text-sm mb-1 line-clamp-1">{title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      <Dialog open={isPlaying} onOpenChange={setIsPlaying}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video rounded-lg overflow-hidden">
            <iframe
              src={videoUrl}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
