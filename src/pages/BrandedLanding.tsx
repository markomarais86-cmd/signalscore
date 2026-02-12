import { useParams, Navigate } from "react-router-dom";
import { useBrandedConfig } from "@/hooks/useBrandedConfig";
import { BrandedMarketingNav } from "@/components/marketing/BrandedMarketingNav";
import { QuizFunnel } from "@/components/marketing/QuizFunnel";
import { Skeleton } from "@/components/ui/skeleton";

export default function BrandedLanding() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: brandConfig, isLoading, error } = useBrandedConfig({ slug: orgSlug! });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    );
  }

  if (error || !brandConfig) {
    return <Navigate to="/" replace />;
  }

  const brandStyles = {
    "--brand-primary": brandConfig.brand_primary_color || "hsl(var(--primary))",
    "--brand-secondary": brandConfig.brand_secondary_color || "hsl(var(--secondary))",
  } as React.CSSProperties;

  return (
    <div style={brandStyles} className="min-h-screen bg-background">
      <BrandedMarketingNav
        logoUrl={brandConfig.logo_url}
        companyName={brandConfig.company_name}
        primaryColor={brandConfig.brand_primary_color}
      />

      <main className="container mx-auto px-6 py-16 max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            AI-Driven ICP Intelligence
            {brandConfig.company_name && (
              <span className="block text-lg md:text-xl font-medium mt-2" style={{ color: brandConfig.brand_primary_color || undefined }}>
                for {brandConfig.company_name}
              </span>
            )}
          </h1>
          {brandConfig.value_proposition && (
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {brandConfig.value_proposition}
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl p-6 md:p-8 shadow-lg">
          <QuizFunnel
            source={`branded-${orgSlug}`}
            brandConfig={{
              primaryColor: brandConfig.brand_primary_color || undefined,
            }}
          />
        </div>
      </main>
    </div>
  );
}
