import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionResult;
  resultType?: 'accounts' | 'contacts' | 'analytics' | 'recommendations' | 'insights';
  resultData?: any;
}

export interface ActionResult {
  action: string;
  success: boolean;
  result?: Record<string, any>;
  error?: string;
}

interface UseAIChatOptions {
  context?: {
    currentPage?: string;
    accountCount?: number;
    highFitCount?: number;
    activeIcp?: string;
    viewingAccount?: string;
  };
  onActionExecuted?: (action: ActionResult) => void;
}

// Parse action blocks from AI response
function parseActionFromResponse(content: string): { action: string; parameters: Record<string, any> } | null {
  const actionMatch = content.match(/```action\s*([\s\S]*?)```/);
  if (actionMatch) {
    try {
      return JSON.parse(actionMatch[1].trim());
    } catch {
      return null;
    }
  }
  return null;
}

// Detect result type from action response
function detectResultType(action: string, result: any): ChatMessage['resultType'] {
  if (!result) return undefined;
  
  // Search actions
  if (action === 'search_accounts' || action === 'find_similar_accounts' || 
      action === 'search_by_tech_stack' || action === 'search_recently_funded') {
    return 'accounts';
  }
  if (action === 'search_contacts' || action === 'find_decision_makers' || 
      action === 'recommend_contacts') {
    return 'contacts';
  }
  
  // Analytics actions
  if (action === 'analyze_pipeline' || action === 'analyze_territory' || 
      action === 'analyze_persona_coverage' || action === 'get_scoring_insights' ||
      action === 'compare_segments') {
    return 'analytics';
  }
  
  // Recommendation actions
  if (action === 'recommend_accounts' || action === 'suggest_icp_improvements' ||
      action === 'identify_gaps' || action === 'surface_opportunities') {
    return 'recommendations';
  }
  
  // General insights
  if (action === 'get_insights') {
    return 'insights';
  }
  
  return undefined;
}

// Memory persistence helpers
async function saveToMemory(orgId: string, userId: string, key: string, value: any, type: string = 'context') {
  try {
    await supabase.from('ai_memory').upsert({
      org_id: orgId,
      user_id: userId,
      memory_key: key,
      memory_type: type,
      memory_value: value,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'org_id,user_id,memory_key',
    });
  } catch (e) {
    console.error('Failed to save AI memory:', e);
  }
}

async function loadFromMemory(orgId: string, userId: string, key: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from('ai_memory')
      .select('memory_value')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('memory_key', key)
      .single();
    return data?.memory_value || null;
  } catch {
    return null;
  }
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; parameters: Record<string, any> } | null>(null);
  const [recentFilters, setRecentFilters] = useState<Record<string, any>>({});
  const [sessionContext, setSessionContext] = useState<{
    lastAction?: string;
    lastResultType?: string;
    topResults?: any[];
  }>({});

  // Load recent context on mount
  useEffect(() => {
    async function loadContext() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', session.user.id)
        .single();

      if (profile?.org_id) {
        const savedFilters = await loadFromMemory(profile.org_id, session.user.id, 'recent_filters');
        if (savedFilters) setRecentFilters(savedFilters);
      }
    }
    loadContext();
  }, []);

  const executeAction = useCallback(async (actionData: { action: string; parameters: Record<string, any> }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to execute actions');
        return null;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile?.org_id) {
        toast.error('Organization not found');
        return null;
      }

      const response = await supabase.functions.invoke('ai-actions', {
        body: {
          action: actionData.action,
          parameters: actionData.parameters,
          org_id: profile.org_id,
          user_id: session.user.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result: ActionResult = response.data;
      
      if (result.success) {
        toast.success(result.result?.message?.slice(0, 100) || `Action "${actionData.action}" completed`);
        options.onActionExecuted?.(result);

        // Save recent filters for memory
        if (actionData.parameters && Object.keys(actionData.parameters).length > 0) {
          const newFilters = { ...recentFilters, [actionData.action]: actionData.parameters };
          setRecentFilters(newFilters);
          saveToMemory(profile.org_id, session.user.id, 'recent_filters', newFilters);
        }

        // Update session context
        setSessionContext({
          lastAction: actionData.action,
          lastResultType: detectResultType(actionData.action, result.result),
          topResults: result.result?.accounts?.slice(0, 3) || result.result?.contacts?.slice(0, 3),
        });
      } else {
        toast.error(result.error || 'Action failed');
      }

      return result;
    } catch (error) {
      console.error('Action execution error:', error);
      toast.error('Failed to execute action');
      return null;
    }
  }, [options, recentFilters]);

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    const result = await executeAction(pendingAction);
    
    if (result) {
      const resultType = detectResultType(pendingAction.action, result.result);
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.action = result;
          lastMsg.resultType = resultType;
          lastMsg.resultData = result.result;
        }
        return newMessages;
      });

      // Add a follow-up message about the result
      if (result.success && result.result?.message) {
        const followUp: ChatMessage = {
          role: 'assistant',
          content: `✅ **Action completed!**\n\n${result.result.message}`,
          resultType,
          resultData: result.result,
        };
        setMessages(prev => [...prev, followUp]);
      }
    }

    setPendingAction(null);
    setIsLoading(false);
  }, [pendingAction, executeAction]);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Action cancelled. Let me know if you need anything else!'
    }]);
  }, []);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = '';

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: 'assistant', content: assistantContent }];
      });
    };

    try {
      // Build enhanced context
      const enhancedContext = {
        ...options.context,
        recentFilters: Object.keys(recentFilters).length > 0 ? recentFilters : undefined,
        ...sessionContext,
      };

      const CHAT_URL = `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/ai-chat`;
      
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM`,
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          context: enhancedContext,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          toast.error('Rate limit exceeded. Please wait a moment.');
        } else if (resp.status === 402) {
          toast.error('AI credits exhausted. Please contact support.');
        } else {
          toast.error(errorData.error || 'Failed to get AI response');
        }
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        throw new Error('No response body');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (const raw of textBuffer.split('\n')) {
          if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Check if response contains an action
      const actionData = parseActionFromResponse(assistantContent);
      if (actionData) {
        setPendingAction(actionData);
      }

    } catch (error) {
      console.error('AI chat error:', error);
      toast.error('Failed to connect to AI assistant');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, options.context, recentFilters, sessionContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingAction(null);
    setSessionContext({});
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    pendingAction,
    confirmAction,
    cancelAction,
    sessionContext,
    recentFilters,
  };
}
