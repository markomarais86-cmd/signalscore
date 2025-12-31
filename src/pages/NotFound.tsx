import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <GradientBackground variant="auth" showOrbs={true}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card variant="glass" className="w-full max-w-md border-border/30 text-center">
          <div className="p-8 space-y-6">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <BrandLogo collapsed={false} />
            </div>

            {/* 404 Display */}
            <div className="space-y-2">
              <h1 className="text-7xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                404
              </h1>
              <h2 className="text-xl font-semibold text-foreground">
                Page Not Found
              </h2>
              <p className="text-muted-foreground">
                The page you're looking for doesn't exist or has been moved.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button asChild className="gap-2">
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Return Home
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </GradientBackground>
  );
};

export default NotFound;
