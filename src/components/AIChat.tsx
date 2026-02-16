import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send, Trash2, CheckCircle, XCircle, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIChat, ChatMessage } from '@/hooks/use-ai-chat';
import { useAIMemory } from '@/hooks/use-ai-memory';
import { cn } from '@/lib/utils';
import { LaunchPulseMark } from '@/components/BrandLogo';
import { 
  AccountCardList, 
  ContactCardList, 
  InsightCard,
  FilterBadges, 
  SuggestedActions,
  WorkflowProgressMini,
  RecommendedAccountsList,
  PlatformInsightsCard,
  parseFiltersFromParams,
  getSearchFollowUpActions,
  getContextualActions,
  getRecommendationFollowUpActions,
  getInsightsFollowUpActions,
  type InsightData,
  type PlatformInsightsData,
} from '@/components/ai-chat';

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/': [
    'Analyze my pipeline health',
    'What accounts should I prioritize?',
    'Find gaps in my data',
  ],
  '/icp-manager': [
    'How can I improve my ICP?',
    'Create a new ICP for enterprise SaaS',
    'Compare tech vs healthcare segments',
  ],
  '/accounts': [
    'Find tech companies with CTOs scoring above 70',
    'Analyze my territory by geography',
    'Show recently funded high-fit accounts',
  ],
  '/leads': [
    'Find decision makers at high-fit accounts',
    'Analyze persona coverage',
    'Recommend contacts to reach out to',
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
    'Qualify all open leads now',
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
  search_contacts: 'Search Contacts',
  find_similar_accounts: 'Find Similar Accounts',
  find_decision_makers: 'Find Decision Makers',
  search_by_tech_stack: 'Search by Tech Stack',
  search_recently_funded: 'Find Recently Funded',
  analyze_pipeline: 'Analyze Pipeline',
  analyze_territory: 'Analyze Territory',
  analyze_persona_coverage: 'Analyze Personas',
  get_scoring_insights: 'Scoring Insights',
  compare_segments: 'Compare Segments',
  recommend_accounts: 'Recommend Accounts',
  recommend_contacts: 'Recommend Contacts',
  suggest_icp_improvements: 'ICP Suggestions',
  identify_gaps: 'Identify Gaps',
  surface_opportunities: 'Find Opportunities',
  cleanup_jobs: 'Clean Up Jobs',
  qualify_leads: 'Qualify Leads',
  // Tier 6: Execution Actions
  enrich_accounts: 'Enrich Accounts',
  enrich_contacts: 'Enrich Contacts',
  export_list: 'Export List',
  create_campaign: 'Create Campaign',
  update_icp: 'Update ICP',
  sync_to_crm: 'Sync to CRM',
  schedule_enrichment: 'Schedule Enrichment',
};

function MessageBubble({ message, onSendMessage }: { message: ChatMessage; onSendMessage: (msg: string) => void }) {
  const isUser = message.role === 'user';
  const navigate = useNavigate();
  
  // Clean action blocks from display
  const displayContent = message.content.replace(/```action[\s\S]*?```/g, '').trim();
  
  // Render rich result cards based on result type
  const renderResultCards = () => {
    if (!message.resultData || !message.resultType) return null;

    switch (message.resultType) {
      case 'accounts':
        if (message.resultData.accounts?.length > 0) {
          return (
            <div className="mt-3">
              <AccountCardList 
                accounts={message.resultData.accounts}
                onViewAccount={(id) => navigate(`/accounts?id=${id}`)}
                onFindContacts={(id) => onSendMessage(`Find decision makers at account ${id}`)}
                maxDisplay={3}
              />
              <div className="mt-2">
                <SuggestedActions 
                  actions={getSearchFollowUpActions('accounts', true)}
                  onActionClick={onSendMessage}
                  compact
                />
              </div>
            </div>
          );
        }
        break;

      case 'contacts':
        if (message.resultData.contacts?.length > 0) {
          return (
            <div className="mt-3">
              <ContactCardList 
                contacts={message.resultData.contacts}
                maxDisplay={3}
              />
              <div className="mt-2">
                <SuggestedActions 
                  actions={getSearchFollowUpActions('contacts', true)}
                  onActionClick={onSendMessage}
                  compact
                />
              </div>
            </div>
          );
        }
        break;

      case 'analytics':
        if (message.resultData.insights) {
          const insights: InsightData[] = [];
          const data = message.resultData.insights;
          
          if (data.total_scored !== undefined) {
            insights.push({ title: 'Total Scored', value: data.total_scored, type: 'info' });
          }
          if (data.high_fit_count !== undefined) {
            insights.push({ 
              title: 'High Fit', 
              value: data.high_fit_count, 
              subtitle: `${data.high_fit_percentage || 0}%`,
              type: 'success' 
            });
          }
          if (data.coverage_rate !== undefined) {
            insights.push({ 
              title: 'Coverage', 
              value: `${data.coverage_rate}%`, 
              type: data.coverage_rate >= 50 ? 'success' : 'warning',
              progress: data.coverage_rate,
            });
          }
          if (data.decision_makers_identified !== undefined) {
            insights.push({ title: 'Decision Makers', value: data.decision_makers_identified, type: 'info' });
          }

          if (insights.length > 0) {
            return (
              <div className="mt-3 space-y-2">
                {insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} compact />
                ))}
              </div>
            );
          }
        }
        break;

      case 'recommendations':
        if (message.resultData.accounts?.length > 0) {
          const accountIds = message.resultData.accounts.map((a: any) => a.external_id);
          return (
            <div className="mt-3">
              <RecommendedAccountsList
                accounts={message.resultData.accounts.map((a: any, i: number) => ({
                  ...a,
                  priority_reasoning: a.reasoning || a.priority_reasoning,
                  recommendation_rank: i + 1,
                }))}
                onViewAccount={(id) => navigate(`/accounts?id=${id}`)}
                onFindContacts={(id) => onSendMessage(`Find decision makers at account ${id}`)}
                onCreateCampaign={(ids) => onSendMessage(`Create outbound campaign with accounts: ${ids.join(', ')}`)}
                maxDisplay={5}
              />
              <div className="mt-2">
                <SuggestedActions 
                  actions={getRecommendationFollowUpActions(accountIds)}
                  onActionClick={onSendMessage}
                  compact
                />
              </div>
            </div>
          );
        }
        break;

      case 'insights':
        const insightsData: PlatformInsightsData = {
          total_accounts: message.resultData.total_accounts || 0,
          total_leads: message.resultData.total_leads || 0,
          scored_accounts: message.resultData.scored_accounts || 0,
          high_fit: message.resultData.high_fit || 0,
          medium_fit: message.resultData.medium_fit || 0,
          low_fit: message.resultData.low_fit || 0,
          icps: message.resultData.icps || [],
          data_quality: message.resultData.data_quality,
          recommendations: message.resultData.recommendations,
        };
        return (
          <div className="mt-3">
            <PlatformInsightsCard 
              insights={insightsData}
              onAction={onSendMessage}
            />
            <div className="mt-2">
              <SuggestedActions 
                actions={getInsightsFollowUpActions()}
                onActionClick={onSendMessage}
                compact
              />
            </div>
          </div>
        );
    }

    return null;
  };
  
  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <LaunchPulseMark className="w-4 h-4" />
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
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{displayContent}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs [&>h1]:my-1.5 [&>h2]:my-1.5 [&>h3]:my-1 [&>table]:text-xs [&_code]:text-xs [&_code]:bg-muted-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
            <ReactMarkdown>{displayContent}</ReactMarkdown>
          </div>
        )}
        
        {/* Render rich cards */}
        {renderResultCards()}
        
        {message.action && (
          <div className={cn(
            'mt-2 pt-2 border-t text-xs flex items-center gap-1',
            message.action.success ? 'text-[hsl(var(--status-success))]' : 'text-destructive'
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
  const filters = parseFiltersFromParams(action.parameters);
  
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <LaunchPulseMark className="w-4 h-4" />
        <span className="font-medium text-sm">Ready to execute action</span>
      </div>
      <div className="text-xs text-muted-foreground mb-3">
        <strong>{ACTION_LABELS[action.action] || action.action}</strong>
        
        {/* Show filters as badges */}
        {filters.length > 0 && (
          <div className="mt-2">
            <FilterBadges filters={filters} compact />
          </div>
        )}
        
        {/* Show remaining parameters */}
        {action.parameters && Object.keys(action.parameters).length > 0 && filters.length === 0 && (
          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-20 overflow-auto">
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

  // AI Memory integration
  const { 
    preferences, 
    templates, 
    suggestions: aiSuggestions, 
    learnPreference, 
    refreshSuggestions,
    isLoading: memoryLoading 
  } = useAIMemory();

  // Learn from successful actions
  const handleActionExecuted = useCallback((action: { action: string; success: boolean; result?: any }) => {
    if (action.action === 'create_icp' && action.success) {
      setTimeout(() => navigate('/icp-manager'), 1500);
    }
    
    // Learn user preferences from successful actions
    if (action.success && action.result) {
      // Learn industry preferences
      if (action.result.filters?.industries?.length) {
        learnPreference('preferred_industries', action.result.filters.industries, `action:${action.action}`);
      }
      // Learn geography preferences
      if (action.result.filters?.countries?.length) {
        learnPreference('preferred_geographies', action.result.filters.countries, `action:${action.action}`);
      }
      // Learn persona preferences
      if (action.result.filters?.personas?.length) {
        learnPreference('preferred_personas', action.result.filters.personas, `action:${action.action}`);
      }
      // Learn action frequency
      learnPreference(`action_frequency:${action.action}`, Date.now(), `action:${action.action}`);
    }
  }, [navigate, learnPreference]);

  const { messages, isLoading, sendMessage, clearMessages, pendingAction, confirmAction, cancelAction, activeWorkflow, cancelWorkflow } = useAIChat({
    context: { 
      currentPage,
      // Include learned preferences in context
      userPreferences: Object.keys(preferences).length > 0 ? preferences : undefined,
    },
    onActionExecuted: handleActionExecuted,
  });

  // Refresh AI suggestions when chat opens
  useEffect(() => {
    if (isOpen) {
      refreshSuggestions(currentPage);
    }
  }, [isOpen, currentPage, refreshSuggestions]);

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

  // Listen for custom events to open chat (from Help page, Dashboard, etc.)
  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    const handleOpenChatWithMessage = (e: CustomEvent<{ message?: string }>) => {
      setIsOpen(true);
      if (e.detail?.message) {
        // Send the message after a short delay to ensure chat is open
        setTimeout(() => {
          sendMessage(e.detail.message!);
        }, 200);
      }
    };
    window.addEventListener('openAIChat', handleOpenChat);
    window.addEventListener('open-ai-chat', handleOpenChatWithMessage as EventListener);
    return () => {
      window.removeEventListener('openAIChat', handleOpenChat);
      window.removeEventListener('open-ai-chat', handleOpenChatWithMessage as EventListener);
    };
  }, [sendMessage]);

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
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[36rem] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <LaunchPulseMark className="w-5 h-5" />
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
                  I can search accounts, analyze your pipeline, find opportunities, and more. What would you like to do?
                </p>
                <SuggestedActions 
                  actions={getContextualActions({ currentPage })}
                  onActionClick={handleSuggestion}
                  title="Try these:"
                />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Or ask:</p>
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
                  <MessageBubble key={i} message={msg} onSendMessage={sendMessage} />
                ))}
                {pendingAction && (
                  <ActionConfirmation
                    action={pendingAction}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                    isLoading={isLoading}
                  />
                )}
                {activeWorkflow && (
                  <div className="mb-3">
                    <WorkflowProgressMini
                      name={activeWorkflow.name}
                      currentStep={activeWorkflow.currentStep}
                      totalSteps={activeWorkflow.totalSteps}
                      status={activeWorkflow.status}
                    />
                    {activeWorkflow.status === 'running' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 text-xs w-full"
                        onClick={cancelWorkflow}
                      >
                        Cancel Workflow
                      </Button>
                    )}
                  </div>
                )}
                {isLoading && !pendingAction && !activeWorkflow && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <LaunchPulseMark className="w-4 h-4 animate-pulse" />
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
