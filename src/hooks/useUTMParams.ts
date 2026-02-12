import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/**
 * Extracts UTM parameters from the current URL search params.
 * Returns a stable object with only the present UTM values.
 */
export function useUTMParams(): UTMParams {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const params: UTMParams = {};
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        params[key] = value;
      }
    }
    return params;
  }, [searchParams]);
}
