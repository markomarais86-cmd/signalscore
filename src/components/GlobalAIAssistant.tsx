import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ROUTE_CONTEXT: Record<string, string> = {
  "/": "The user is viewing the executive dashboard with growth metrics, ICP coverage, and data health.",
  "/accounts": "The user is viewing their accounts list with scoring and enrichment data.",
  "/leads": "The user is viewing contacts and leads.",
  "/icp-manager": "The user is configuring ideal customer profiles and scoring criteria.",
  "/enrichment": "The user is managing data enrichment workflows.",
  "/campaigns": "The user is managing marketing campaigns.",
  "/analytics": "The user is viewing analytics reports and insights.",
  "/settings": "The user is in application settings.",
  "/admin": "The user is on the platform admin dashboard managing organizations and users.",
  "/data-upload": "The user is uploading CSV data.",
};

function getRouteContext(pathname: string): string {
  return ROUTE_CONTEXT[pathname] || `The user is on the ${pathname} page.`;
}

export function GlobalAIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+J shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Listen for custom event from command palette
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openGlobalAI", handler);
    return () => window.removeEventListener("openGlobalAI", handler);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const routeContext = getRouteContext(location.pathname);
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          message: trimmed,
          context: routeContext,
          messages: updatedMessages.slice(-10), // Last 10 messages for context
        },
      });

      if (error) throw error;

      const assistantContent = data?.response || data?.message || "I couldn't generate a response.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
    } catch (err: any) {
      console.error("AI chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, location.pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Assistant
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘J
            </kbd>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-3 min-h-[300px] max-h-[420px]" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">Ask me anything about your data</p>
              <p className="text-xs mt-1">I'm context-aware based on your current page</p>
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm rounded-lg px-3 py-2 max-w-[85%]",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
