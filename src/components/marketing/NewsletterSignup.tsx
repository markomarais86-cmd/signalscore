import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface NewsletterSignupProps {
  source?: string;
  compact?: boolean;
}

export function NewsletterSignup({ source = "newsletter-landing", compact = false }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from("marketing_leads" as any)
        .insert({ email, source } as any);

      // Treat unique constraint violation as success (already subscribed)
      if (insertError && !insertError.message?.includes("duplicate")) {
        throw insertError;
      }

      setIsSuccess(true);
      setEmail("");
    } catch (err: any) {
      console.error("Newsletter signup error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "" : "justify-center py-4"}`}>
        <CheckCircle2 className="h-5 w-5 text-green-400" />
        <span className="text-white/80 text-sm">You're in! We'll keep you updated.</span>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <p className="text-sm font-medium text-white/70">Get GTM insights</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={isSubmitting} variant="secondary" className="h-9 shrink-0">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <div className="text-center max-w-lg mx-auto">
      <div className="inline-flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold text-white">Stay in the loop</h3>
      </div>
      <p className="text-white/60 text-sm mb-5">
        Get the latest GTM intelligence insights, product updates, and early access announcements.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
        <Button type="submit" disabled={isSubmitting} variant="glow" className="shrink-0">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-white/30 mt-3">
        No spam. Unsubscribe anytime.{" "}
        <Link to="/privacy" className="underline hover:text-white/50">Privacy Policy</Link>
      </p>
    </div>
  );
}
