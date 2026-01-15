import { useState, useCallback } from "react";
import { Search, Loader2, Sparkles, Building2, User, X, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  source_type: "account" | "lead";
  source_id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, any>;
  record?: {
    name?: string;
    domain?: string;
    industry_norm?: string;
    employee_count?: number;
    city?: string;
    country?: string;
    title?: string;
    company?: string;
    email?: string;
  };
}

interface SemanticSearchBarProps {
  orgId: string;
  onResultClick?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

export function SemanticSearchBar({ 
  orgId, 
  onResultClick,
  placeholder = "Search accounts and contacts...",
  className = ""
}: SemanticSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState<"semantic" | "keyword_fallback">("semantic");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setShowResults(true);

    try {
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: {
          org_id: orgId,
          query: searchQuery,
          limit: 10,
          threshold: 0.4,
        },
      });

      if (error) throw error;

      setResults(data.results || []);
      setSearchType(data.search_type || "semantic");
      setLatencyMs(data.latency_ms || null);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: error instanceof Error ? error.message : "Failed to search",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [orgId, toast]);

  const handleSearch = useCallback(() => {
    performSearch(query);
  }, [query, performSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result);
    } else {
      // Default navigation
      if (result.source_type === "account") {
        navigate(`/accounts/${result.source_id}`);
      } else if (result.source_type === "lead") {
        navigate(`/leads?id=${result.source_id}`);
      }
    }
    setShowResults(false);
    setQuery("");
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return "bg-green-500";
    if (similarity >= 0.6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Sparkles className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-20"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleSearch}
            disabled={isLoading || query.length < 2}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {showResults && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {query.length < 2 ? "Type at least 2 characters to search" : "No results found"}
              </div>
            ) : (
              <>
                <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {results.length} result{results.length !== 1 ? "s" : ""} 
                    {latencyMs && ` • ${latencyMs}ms`}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {searchType === "semantic" ? (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Search
                      </>
                    ) : (
                      "Keyword"
                    )}
                  </Badge>
                </div>
                <ScrollArea className="max-h-80">
                  <div className="py-1">
                    {results.map((result) => (
                      <div
                        key={result.id}
                        className="px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {result.source_type === "account" ? (
                              <Building2 className="h-4 w-4 text-primary" />
                            ) : (
                              <User className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {result.record?.name || result.metadata?.name || "Unknown"}
                              </span>
                              <div 
                                className={`h-2 w-2 rounded-full ${getSimilarityColor(result.similarity)}`}
                                title={`${Math.round(result.similarity * 100)}% match`}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {result.source_type === "account" ? (
                                <>
                                  {result.record?.industry_norm && (
                                    <span>{result.record.industry_norm}</span>
                                  )}
                                  {result.record?.industry_norm && result.record?.employee_count && " • "}
                                  {result.record?.employee_count && (
                                    <span>{result.record.employee_count} employees</span>
                                  )}
                                  {(result.record?.city || result.record?.country) && " • "}
                                  {[result.record?.city, result.record?.country].filter(Boolean).join(", ")}
                                </>
                              ) : (
                                <>
                                  {result.record?.title && <span>{result.record.title}</span>}
                                  {result.record?.title && result.record?.company && " at "}
                                  {result.record?.company && <span>{result.record.company}</span>}
                                </>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
