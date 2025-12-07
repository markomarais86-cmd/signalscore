import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionResult;
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

export function useAIChat(options: UseAIChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; parameters: Record<string, any> } | null>(null);

  const executeAction = useCallback(async (actionData: { action: string; parameters: Record<string, any> }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to execute actions');
        return null;
      }

      // Get org_id from user profile
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
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result: ActionResult = response.data;
      
      if (result.success) {
        toast.success(result.result?.message || `Action "${actionData.action}" completed`);
        options.onActionExecuted?.(result);
      } else {
        toast.error(result.error || 'Action failed');
      }

      return result;
    } catch (error) {
      console.error('Action execution error:', error);
      toast.error('Failed to execute action');
      return null;
    }
  }, [options]);

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    const result = await executeAction(pendingAction);
    
    if (result) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.action = result;
        }
        return newMessages;
      });

      // Add a follow-up message about the result
      if (result.success) {
        const followUp: ChatMessage = {
          role: 'assistant',
          content: `✅ **Action completed successfully!**\n\n${result.result?.message || 'The action was executed.'}`
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
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          context: options.context 
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
        for (let raw of textBuffer.split('\n')) {
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
  }, [messages, isLoading, options.context]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingAction(null);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    pendingAction,
    confirmAction,
    cancelAction,
  };
}
