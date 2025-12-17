import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DedupedRequestOptions {
  debounceMs?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface DedupedRequestState {
  isExecuting: boolean;
  lastRequestId: string | null;
  error: Error | null;
}

/**
 * Hook for deduplicating requests to edge functions.
 * Prevents double-clicks and rapid re-submissions from creating duplicate jobs.
 * 
 * @param functionName - Name of the edge function to call
 * @param options - Configuration options
 */
export function useDedupedRequest<TBody = any, TResponse = any>(
  functionName: string,
  options: DedupedRequestOptions = {}
) {
  const { debounceMs = 500, onSuccess, onError } = options;
  
  const [state, setState] = useState<DedupedRequestState>({
    isExecuting: false,
    lastRequestId: null,
    error: null,
  });
  
  // Track in-flight requests
  const inFlightRef = useRef<Map<string, Promise<TResponse>>>(new Map());
  const lastExecutionRef = useRef<number>(0);
  
  /**
   * Generate a request key from the body
   */
  const generateKey = useCallback((body: TBody): string => {
    try {
      const stableBody = JSON.stringify(body, Object.keys(body as object).sort());
      let hash = 0;
      for (let i = 0; i < stableBody.length; i++) {
        const char = stableBody.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `${functionName}:${Math.abs(hash).toString(36)}`;
    } catch {
      return `${functionName}:${Date.now()}`;
    }
  }, [functionName]);
  
  /**
   * Execute the edge function with deduplication
   */
  const execute = useCallback(async (body: TBody): Promise<TResponse | null> => {
    const now = Date.now();
    const key = generateKey(body);
    
    // Debounce rapid calls
    if (now - lastExecutionRef.current < debounceMs) {
      console.log(`[useDedupedRequest] Debounced call to ${functionName}`);
      return null;
    }
    
    // Check for in-flight request with same key
    const existingRequest = inFlightRef.current.get(key);
    if (existingRequest) {
      console.log(`[useDedupedRequest] Returning in-flight request for ${functionName}`);
      return existingRequest;
    }
    
    lastExecutionRef.current = now;
    setState(prev => ({ ...prev, isExecuting: true, error: null }));
    
    // Create the request promise
    const requestPromise = (async (): Promise<TResponse> => {
      const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
        body,
      });
      
      if (error) {
        throw new Error(error.message || 'Request failed');
      }
      
      return data as TResponse;
    })();
    
    // Track in-flight request
    inFlightRef.current.set(key, requestPromise);
    
    try {
      const result = await requestPromise;
      
      setState(prev => ({
        ...prev,
        isExecuting: false,
        lastRequestId: key,
      }));
      
      onSuccess?.(result);
      return result;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: err,
      }));
      
      onError?.(err);
      throw err;
      
    } finally {
      // Remove from in-flight after a short delay (allows for rapid retries)
      setTimeout(() => {
        inFlightRef.current.delete(key);
      }, 1000);
    }
  }, [functionName, generateKey, debounceMs, onSuccess, onError]);
  
  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setState({
      isExecuting: false,
      lastRequestId: null,
      error: null,
    });
    inFlightRef.current.clear();
  }, []);
  
  return {
    execute,
    reset,
    isExecuting: state.isExecuting,
    lastRequestId: state.lastRequestId,
    error: state.error,
  };
}

/**
 * Simple debounced function executor (non-hook version)
 */
export function createDedupedExecutor<TBody, TResponse>(
  functionName: string,
  debounceMs: number = 500
) {
  const inFlight = new Map<string, Promise<TResponse>>();
  let lastExecution = 0;
  
  const generateKey = (body: TBody): string => {
    try {
      const stableBody = JSON.stringify(body, Object.keys(body as object).sort());
      let hash = 0;
      for (let i = 0; i < stableBody.length; i++) {
        const char = stableBody.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `${functionName}:${Math.abs(hash).toString(36)}`;
    } catch {
      return `${functionName}:${Date.now()}`;
    }
  };
  
  return async (body: TBody): Promise<TResponse | null> => {
    const now = Date.now();
    const key = generateKey(body);
    
    if (now - lastExecution < debounceMs) {
      return null;
    }
    
    const existing = inFlight.get(key);
    if (existing) {
      return existing;
    }
    
    lastExecution = now;
    
    const promise = (async (): Promise<TResponse> => {
      const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
        body,
      });
      
      if (error) {
        throw new Error(error.message || 'Request failed');
      }
      
      return data as TResponse;
    })();
    
    inFlight.set(key, promise);
    
    try {
      return await promise;
    } finally {
      setTimeout(() => inFlight.delete(key), 1000);
    }
  };
}
