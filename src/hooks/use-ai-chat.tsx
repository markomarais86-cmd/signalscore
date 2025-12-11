import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionResult;
  resultType?: 'accounts' | 'contacts' | 'analytics' | 'recommendations' | 'insights' | 'workflow';
  resultData?: any;
}

export interface ActionResult {
  action: string;
  success: boolean;
  result?: Record<string, any>;
  error?: string;
}

export interface WorkflowStatus {
  id: string;
  type: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  message?: string;
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
  onWorkflowUpdate?: (status: WorkflowStatus) => void;
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
  
  // Workflow actions
  if (result.isWorkflow || result.workflow_id) {
    return 'workflow';
  }
  
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
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowStatus | null>(null);
  const workflowPollRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup workflow polling on unmount
  useEffect(() => {
    return () => {
      if (workflowPollRef.current) {
        clearInterval(workflowPollRef.current);
      }
    };
  }, []);

  // Poll workflow status
  const pollWorkflowStatus = useCallback(async (workflowId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          action: 'get_workflow_status',
          workflow_id: workflowId,
        },
      });

      if (response.data?.success && response.data.workflow) {
        const wf = response.data.workflow;
        const status: WorkflowStatus = {
          id: wf.id,
          type: wf.type,
          name: wf.name,
          status: wf.status,
          currentStep: wf.current_step,
          totalSteps: wf.total_steps,
          progressPercentage: wf.progress_percentage,
          message: wf.status === 'completed' ? 'Workflow completed' : `Step ${wf.current_step}/${wf.total_steps}`,
        };

        setActiveWorkflow(status);
        options.onWorkflowUpdate?.(status);

        // Stop polling when workflow is done
        if (['completed', 'failed', 'cancelled'].includes(wf.status)) {
          if (workflowPollRef.current) {
            clearInterval(workflowPollRef.current);
            workflowPollRef.current = null;
          }
          setActiveWorkflow(null);
        }
      }
    } catch (error) {
      console.error('Failed to poll workflow status:', error);
    }
  }, [options]);

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
        // Check if this is a workflow action
        if (result.result?.isWorkflow && result.result?.workflow_id) {
          toast.success(`Workflow started: ${result.result.workflow_name || actionData.action}`);
          
          // Start polling for workflow status
          setActiveWorkflow({
            id: result.result.workflow_id,
            type: result.result.workflowType,
            name: result.result.workflow_name || actionData.action,
            status: 'running',
            currentStep: 0,
            totalSteps: result.result.total_steps || 0,
            progressPercentage: 0,
          });

          // Poll every 2 seconds
          workflowPollRef.current = setInterval(() => {
            pollWorkflowStatus(result.result!.workflow_id);
          }, 2000);
        } else {
          toast.success(result.result?.message?.slice(0, 100) || `Action "${actionData.action}" completed`);
        }
        
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
  }, [options, recentFilters, pollWorkflowStatus]);

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
    let streamHealthCheck: NodeJS.Timeout | null = null;
    let lastActivity = Date.now();

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      lastActivity = Date.now();
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

    // Cleanup helper
    const cleanup = () => {
      if (streamHealthCheck) {
        clearInterval(streamHealthCheck);
        streamHealthCheck = null;
      }
    };

    try {
      // Build enhanced context
      const enhancedContext = {
        ...options.context,
        recentFilters: Object.keys(recentFilters).length > 0 ? recentFilters : undefined,
        ...sessionContext,
      };

      const CHAT_URL = `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/ai-chat`;
      
      // Add 60-second timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
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
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

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

      // Stream health check - abort if no data for 30 seconds
      streamHealthCheck = setInterval(() => {
        if (Date.now() - lastActivity > 30000) {
          console.warn('Stream health check: No data received for 30s, aborting...');
          reader.cancel();
          cleanup();
        }
      }, 5000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          lastActivity = Date.now();
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
      } finally {
        cleanup();
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
      cleanup();
      console.error('AI chat error:', error);
      
      // User-friendly error messages based on error type
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out. The AI may be busy - please try again.');
      } else {
        toast.error('Failed to connect to AI assistant. Please try again.');
      }
      
      // Remove empty assistant message if no content was received
      if (!assistantContent) {
        setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && !m.content)));
      }
    } finally {
      cleanup();
      setIsLoading(false);
    }
  }, [messages, isLoading, options.context, recentFilters, sessionContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingAction(null);
    setSessionContext({});
    setActiveWorkflow(null);
    if (workflowPollRef.current) {
      clearInterval(workflowPollRef.current);
      workflowPollRef.current = null;
    }
  }, []);

  const cancelWorkflow = useCallback(async () => {
    if (!activeWorkflow) return;

    try {
      await supabase.functions.invoke('ai-orchestrator', {
        body: {
          action: 'cancel_workflow',
          workflow_id: activeWorkflow.id,
        },
      });

      toast.success('Workflow cancelled');
      setActiveWorkflow(null);
      if (workflowPollRef.current) {
        clearInterval(workflowPollRef.current);
        workflowPollRef.current = null;
      }
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      toast.error('Failed to cancel workflow');
    }
  }, [activeWorkflow]);

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
    activeWorkflow,
    cancelWorkflow,
  };
}
