import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface ClickIds {
  gclid?: string;
  fbclid?: string;
  li_fat_id?: string;
}

export interface TrackingParams {
  utmParams: UTMParams;
  clickIds: ClickIds;
  funnelVariant?: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const CLICK_ID_KEYS = ['gclid', 'fbclid', 'li_fat_id'] as const;

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

/**
 * Extracts UTM params, ad platform click IDs, and funnel variant from URL.
 */
export function useTrackingParams(): TrackingParams {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const utmParams: UTMParams = {};
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) utmParams[key] = value;
    }

    const clickIds: ClickIds = {};
    for (const key of CLICK_ID_KEYS) {
      const value = searchParams.get(key);
      if (value) clickIds[key] = value;
    }

    const funnelVariant = searchParams.get('variant') || undefined;

    return { utmParams, clickIds, funnelVariant };
  }, [searchParams]);
}
