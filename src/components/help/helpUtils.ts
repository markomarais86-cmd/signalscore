import { HelpItem } from './helpContent';

/**
 * Fuzzy search implementation for help content
 */
export function searchHelpContent(
  items: HelpItem[],
  query: string
): HelpItem[] {
  if (!query || query.trim().length === 0) {
    return items;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const searchTerms = normalizedQuery.split(/\s+/);

  const scoredItems = items.map(item => {
    let score = 0;

    // Search in title (highest weight)
    const titleMatch = item.title.toLowerCase().includes(normalizedQuery);
    if (titleMatch) score += 100;

    // Search in description
    const descMatch = item.description.toLowerCase().includes(normalizedQuery);
    if (descMatch) score += 50;

    // Search in keywords (high weight)
    const keywordMatches = item.keywords.filter(keyword =>
      keyword.toLowerCase().includes(normalizedQuery)
    );
    score += keywordMatches.length * 40;

    // Search in content
    const contentMatch = item.content.toLowerCase().includes(normalizedQuery);
    if (contentMatch) score += 20;

    // Bonus for matching multiple search terms
    const termsMatched = searchTerms.filter(term =>
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.keywords.some(k => k.toLowerCase().includes(term))
    );
    score += termsMatched.length * 10;

    return { item, score };
  });

  // Filter out items with no matches and sort by score
  return scoredItems
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

/**
 * Get help items relevant to a specific page/route
 */
export function getContextualHelp(
  items: HelpItem[],
  currentPath: string
): HelpItem[] {
  return items
    .filter(item => item.relatedPages.includes(currentPath))
    .slice(0, 5); // Return top 5 most relevant
}

/**
 * Get text highlighting info for search results
 * Returns the original text and indices for highlighting
 */
export function getHighlightIndices(text: string, query: string): { start: number; end: number } | null {
  if (!query || query.trim().length === 0) {
    return null;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const index = text.toLowerCase().indexOf(normalizedQuery);

  if (index === -1) {
    return null;
  }

  return {
    start: index,
    end: index + query.length
  };
}

/**
 * Get page title from route path
 */
export function getPageTitle(path: string): string {
  const pathMap: Record<string, string> = {
    '/': 'Executive Dashboard',
    '/icp-manager': 'ICP Manager',
    '/accounts': 'Accounts',
    '/leads': 'Leads',
    '/data-upload': 'Data Upload',
    '/settings': 'Settings',
    '/admin': 'Admin Dashboard',
    '/pipeline-efficiency': 'Pipeline Efficiency',
    '/capital-efficiency': 'Capital Efficiency',
    '/reports': 'Report Builder',
    '/segmentation': 'Segmentation',
    '/trends': 'Trends',
  };

  return pathMap[path] || 'LaunchPulse';
}

/**
 * Store and retrieve recent help history from localStorage
 */
const RECENT_HELP_KEY = 'launchpulse_recent_help';
const MAX_RECENT_ITEMS = 5;

export function addToRecentHelp(itemId: string): void {
  try {
    const recent = getRecentHelp();
    const filtered = recent.filter(id => id !== itemId);
    const updated = [itemId, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(RECENT_HELP_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent help:', error);
  }
}

export function getRecentHelp(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_HELP_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load recent help:', error);
    return [];
  }
}

/**
 * Store and retrieve watched videos from localStorage
 */
const WATCH_LATER_KEY = 'launchpulse_watch_later';

export function addToWatchLater(videoId: string): void {
  try {
    const watchLater = getWatchLater();
    if (!watchLater.includes(videoId)) {
      const updated = [...watchLater, videoId];
      localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(updated));
    }
  } catch (error) {
    console.error('Failed to save watch later:', error);
  }
}

export function removeFromWatchLater(videoId: string): void {
  try {
    const watchLater = getWatchLater();
    const updated = watchLater.filter(id => id !== videoId);
    localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update watch later:', error);
  }
}

export function getWatchLater(): string[] {
  try {
    const stored = localStorage.getItem(WATCH_LATER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load watch later:', error);
    return [];
  }
}

export function isInWatchLater(videoId: string): boolean {
  return getWatchLater().includes(videoId);
}
