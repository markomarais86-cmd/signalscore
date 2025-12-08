import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MemoryEntry {
  key: string;
  type: 'conversation' | 'preference' | 'template' | 'context';
  value: any;
  confidence?: number;
  learnedFrom?: string[];
  updatedAt?: string;
}

export interface ActionTemplate {
  id: string;
  name: string;
  description?: string;
  actionType: string;
  parameters: Record<string, any>;
  usageCount: number;
  lastUsed?: string;
}

export interface Suggestion {
  type: 'template' | 'frequent' | 'preference';
  text: string;
  description: string;
  action: string;
  parameters?: Record<string, any>;
  confidence: number;
}

export interface UseAIMemoryReturn {
  preferences: Record<string, any>;
  templates: ActionTemplate[];
  suggestions: Suggestion[];
  isLoading: boolean;
  saveMemory: (entries: MemoryEntry[]) => Promise<void>;
  loadMemory: (keys?: string[], types?: string[]) => Promise<MemoryEntry[]>;
  learnPreference: (preference: string, value: any, source: string) => Promise<void>;
  saveTemplate: (template: Omit<ActionTemplate, 'id' | 'usageCount' | 'lastUsed'>) => Promise<string>;
  refreshSuggestions: (context?: string) => Promise<void>;
  clearMemory: (types?: string[]) => Promise<void>;
}

export function useAIMemory(): UseAIMemoryReturn {
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const callMemoryFunction = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('ai-memory', {
      body: { action, ...params },
    });

    if (error) throw error;
    return data;
  }, []);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
    loadTemplates();
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const result = await callMemoryFunction('get_preferences');
      setPreferences(result.preferences || {});
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }, [callMemoryFunction]);

  const loadTemplates = useCallback(async () => {
    try {
      const result = await callMemoryFunction('get_templates', { limit: 10 });
      setTemplates(result.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, [callMemoryFunction]);

  const saveMemory = useCallback(async (entries: MemoryEntry[]) => {
    setIsLoading(true);
    try {
      await callMemoryFunction('save', { entries });
    } finally {
      setIsLoading(false);
    }
  }, [callMemoryFunction]);

  const loadMemory = useCallback(async (keys?: string[], types?: string[]): Promise<MemoryEntry[]> => {
    setIsLoading(true);
    try {
      const result = await callMemoryFunction('load', { keys, types });
      return result.entries || [];
    } finally {
      setIsLoading(false);
    }
  }, [callMemoryFunction]);

  const learnPreference = useCallback(async (preference: string, value: any, source: string) => {
    try {
      await callMemoryFunction('learn_preference', { preference, value, source });
      // Refresh preferences
      await loadPreferences();
    } catch (error) {
      console.error('Failed to learn preference:', error);
    }
  }, [callMemoryFunction, loadPreferences]);

  const saveTemplate = useCallback(async (template: Omit<ActionTemplate, 'id' | 'usageCount' | 'lastUsed'>): Promise<string> => {
    setIsLoading(true);
    try {
      const result = await callMemoryFunction('save_template', {
        name: template.name,
        description: template.description,
        actionType: template.actionType,
        parameters: template.parameters,
      });
      // Refresh templates
      await loadTemplates();
      return result.templateId;
    } finally {
      setIsLoading(false);
    }
  }, [callMemoryFunction, loadTemplates]);

  const refreshSuggestions = useCallback(async (context?: string) => {
    try {
      const result = await callMemoryFunction('get_suggestions', { context, limit: 5 });
      setSuggestions(result.suggestions || []);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  }, [callMemoryFunction]);

  const clearMemory = useCallback(async (types?: string[]) => {
    setIsLoading(true);
    try {
      await callMemoryFunction('clear', { types, all: !types });
      if (!types || types.includes('preference')) {
        setPreferences({});
      }
      if (!types || types.includes('template')) {
        setTemplates([]);
      }
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [callMemoryFunction]);

  return {
    preferences,
    templates,
    suggestions,
    isLoading,
    saveMemory,
    loadMemory,
    learnPreference,
    saveTemplate,
    refreshSuggestions,
    clearMemory,
  };
}
