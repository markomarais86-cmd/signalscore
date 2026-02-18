import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlideDeck } from '@/hooks/use-slide-deck';
import { SlideDeck } from '@/components/slides/SlideDeck';
import { Loader2 } from 'lucide-react';

export default function Presentations() {
  const navigate = useNavigate();
  const { isLoading, reportData, loadDeck, logoUrl, brandColor } = useSlideDeck();

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  if (isLoading || !reportData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Generating your pitch deck…</p>
        <p className="text-sm text-muted-foreground">This may take a moment while we prepare AI insights.</p>
      </div>
    );
  }

  return (
    <SlideDeck
      data={reportData}
      logoUrl={logoUrl}
      brandColor={brandColor}
      onBack={() => navigate('/dashboard')}
    />
  );
}
