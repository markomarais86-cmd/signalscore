import { useEffect } from 'react';
import { AIFeedbackQueue } from '@/components/feedback';

export default function AIFeedbackPage() {
  useEffect(() => {
    document.title = 'AI Feedback Queue | Review Enrichments';
  }, []);

  return (
    <>
      
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Enrichment Review</h1>
          <p className="text-muted-foreground">
            Review, approve, or reject AI-generated data enrichments
          </p>
        </div>

        <AIFeedbackQueue />
      </div>
    </>
  );
}
