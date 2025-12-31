import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Loader2, 
  MessageSquare, 
  Sparkles,
  User,
  Bot,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { useAccountAI } from '@/hooks/useAccountAI';
import { LaunchPulseMark } from '@/components/BrandLogo';
import { cn } from '@/lib/utils';

interface AskAccountAIProps {
  accountExternalId: string;
  accountName?: string;
}

const SUGGESTED_QUESTIONS = [
  "Who should I contact first at this account?",
  "What's the best approach for engaging this account?",
  "What are the key risks with this account?",
  "What makes this account a good fit for us?",
  "What similar accounts have we closed?",
  "What are the buying signals for this account?",
];

export function AskAccountAI({ accountExternalId, accountName }: AskAccountAIProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { messages, isAsking, error, askQuestion, clearMessages } = useAccountAI(accountExternalId);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isAsking) return;
    
    askQuestion(inputValue.trim());
    setInputValue('');
  };

  const handleSuggestedQuestion = (question: string) => {
    if (isAsking) return;
    askQuestion(question);
  };

  const hasMessages = messages.length > 0;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <LaunchPulseMark className="h-5 w-5 text-primary" />
            Ask AI about {accountName || 'this account'}
          </span>
          {hasMessages && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearMessages}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {!hasMessages ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Ask any question about this account
                </p>
                <p className="text-xs text-muted-foreground">
                  AI has access to company data, contacts, activities, and signals
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Suggested questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs py-1.5 px-3"
                      onClick={() => handleSuggestedQuestion(question)}
                    >
                      <Sparkles className="h-3 w-3 mr-1.5" />
                      {question}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-4 py-2.5',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'assistant' && !message.content && isAsking ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about this account..."
              disabled={isAsking}
              className="flex-1"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!inputValue.trim() || isAsking}
            >
              {isAsking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
