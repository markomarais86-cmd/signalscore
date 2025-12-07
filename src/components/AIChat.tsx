import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Sparkles, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIChat, ChatMessage } from '@/hooks/use-ai-chat';
import { cn } from '@/lib/utils';

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/': [
    'Create an ICP for tech startups in the US',
    'Show me my high-fit accounts',
    'How can I improve my ICP?',
  ],
  '/icp-manager': [
    'Create a new ICP for enterprise SaaS',
    'Help me refine my ICP criteria',
    'What industries should I target?',
  ],
  '/accounts': [
    'Search accounts in Technology with score above 70',
    'Find accounts similar to my best customers',
    'Why do some accounts score low?',
  ],
  '/leads': [
    'How do I enrich my leads?',
    'What makes a lead campaign-ready?',
    'Help me filter high-value contacts',
  ],
  '/data-upload': [
    'What data format should I use?',
    'How do I map custom fields?',
    'Best practices for data import',
  ],
  '/ai-agents': [
    'How do AI agents work?',
    'Clean up stuck jobs',
    'Set up automated enrichment',
  ],
  '/settings': [
    'How do I connect my CRM?',
    'Set up Apollo integration',
    'Configure scoring weights',
  ],
};

const ACTION_LABELS: Record<string, string> = {
  create_icp: 'Create ICP Profile',
  trigger_scoring: 'Start Bulk Scoring',
  get_insights: 'Get Insights',
  search_accounts: 'Search Accounts',
  cleanup_jobs: 'Clean Up Jobs',
};

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  
  // Clean action blocks from display
  const displayContent = message.content.replace(/```action[\s\S]*?```/g, '').trim();
  
  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{displayContent}</div>
        {message.action && (
          <div className={cn(
            'mt-2 pt-2 border-t text-xs flex items-center gap-1',
            message.action.success ? 'text-green-600' : 'text-destructive'
          )}>
            {message.action.success ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {message.action.success ? 'Action completed' : message.action.error}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionConfirmationProps {
  action: { action: string; parameters: Record<string, any> };
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ActionConfirmation({ action, onConfirm, onCancel, isLoading }: ActionConfirmationProps) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">Ready to execute action</span>
      </div>
      <div className="text-xs text-muted-foreground mb-3">
        <strong>{ACTION_LABELS[action.action] || action.action}</strong>
        {action.parameters && Object.keys(action.parameters).length > 0 && (
          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono">
            {JSON.stringify(action.parameters, null, 2)}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={isLoading} className="flex-1">
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
          Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isLoading} className="flex-1">
          <XCircle className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentPage = location.pathname;
  const suggestions = PAGE_SUGGESTIONS[currentPage] || PAGE_SUGGESTIONS['/'];

  const { messages, isLoading, sendMessage, clearMessages, pendingAction, confirmAction, cancelAction } = useAIChat({
    context: { currentPage },
    onActionExecuted: (action) => {
      // Navigate to relevant page after action
      if (action.action === 'create_icp' && action.success) {
        setTimeout(() => navigate('/icp-manager'), 1500);
      }
    },
  });

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingAction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg',
          'bg-primary hover:bg-primary/90 text-primary-foreground',
          'transition-transform hover:scale-105',
          isOpen && 'hidden'
        )}
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[32rem] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">LaunchPulse AI</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearMessages}
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Hi! I can help you create ICPs, score accounts, and more. Try asking me to do something!
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Try these:</p>
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 px-3 text-xs"
                      onClick={() => handleSuggestion(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {pendingAction && (
                  <ActionConfirmation
                    action={pendingAction}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                    isLoading={isLoading}
                  />
                )}
                {isLoading && !pendingAction && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t bg-muted/20">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything or give a command..."
                className="flex-1 text-sm"
                disabled={isLoading || !!pendingAction}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading || !!pendingAction}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
