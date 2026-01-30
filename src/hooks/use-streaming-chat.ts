/**
 * Streaming Chat Hook
 * 
 * Provides token-by-token streaming for AI chat responses
 * with proper SSE parsing and error handling.
 */

import { useState, useCallback, useRef } from 'react';

export interface StreamingMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export interface UseStreamingChatOptions {
  endpoint: string;
  headers?: Record<string, string>;
  onToken?: (token: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  timeout?: number;
}

export interface StreamingChatReturn {
  messages: StreamingMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string, context?: Record<string, any>) => Promise<void>;
  cancelStream: () => void;
  clearMessages: () => void;
}

export function useStreamingChat(options: UseStreamingChatOptions): StreamingChatReturn {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamHealthCheckRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (streamHealthCheckRef.current) {
      clearInterval(streamHealthCheckRef.current);
      streamHealthCheckRef.current = null;
    }
    abortControllerRef.current = null;
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    cleanup();
    setIsStreaming(false);
  }, [cleanup]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (content: string, context?: Record<string, any>) => {
    if (isStreaming) return;

    const userMessage: StreamingMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    let assistantContent = '';
    let lastActivity = Date.now();

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      lastActivity = Date.now();
      options.onToken?.(chunk);
      
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => 
            i === prev.length - 1 
              ? { ...m, content: assistantContent, isStreaming: true } 
              : m
          );
        }
        return [...prev, { role: 'assistant', content: assistantContent, isStreaming: true }];
      });
    };

    try {
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(
        () => abortControllerRef.current?.abort(), 
        options.timeout || 60000
      );

      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          context,
        }),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment.');
        } else if (response.status === 402) {
          throw new Error('AI credits exhausted. Please add credits.');
        }
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      // Stream health check - abort if no data for 30 seconds
      streamHealthCheckRef.current = setInterval(() => {
        if (Date.now() - lastActivity > 30000) {
          console.warn('[streaming-chat] No data for 30s, aborting...');
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
              const tokenContent = parsed.choices?.[0]?.delta?.content;
              if (tokenContent) updateAssistant(tokenContent);
            } catch {
              // Incomplete JSON, put back and wait for more
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
            const tokenContent = parsed.choices?.[0]?.delta?.content;
            if (tokenContent) updateAssistant(tokenContent);
          } catch { /* ignore */ }
        }
      }

      // Mark streaming complete
      setMessages(prev => prev.map((m, i) => 
        i === prev.length - 1 && m.role === 'assistant'
          ? { ...m, isStreaming: false }
          : m
      ));

      options.onComplete?.(assistantContent);

    } catch (err) {
      cleanup();
      const errorMessage = err instanceof Error ? err.message : 'Streaming failed';
      setError(errorMessage);
      options.onError?.(err instanceof Error ? err : new Error(errorMessage));
      
      // Add error message to chat
      if (assistantContent) {
        setMessages(prev => prev.map((m, i) => 
          i === prev.length - 1 && m.role === 'assistant'
            ? { ...m, isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, messages, options, cleanup]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    cancelStream,
    clearMessages,
  };
}
