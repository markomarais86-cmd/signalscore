import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/use-auth";
import { FeatureFlagsProvider } from "./hooks/use-feature-flags";
import { OnboardingProvider } from "./hooks/use-onboarding";
import { ThemeProvider } from "./components/ThemeProvider";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ICPManager from "./pages/ICPManager";
import Leads from "./pages/Leads";
import Accounts from "./pages/Accounts";
import CampaignBuilder from "./pages/CampaignBuilder";
import DataUpload from "./pages/DataUpload";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <OnboardingProvider>
            <FeatureFlagsProvider>
              <TooltipProvider>
                <ErrorBoundary>
                  <Toaster />
                  <BrowserRouter>
                    <OnboardingWizard />
                    <Routes>
                <Route path="/landing" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ExecutiveDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/icp-manager"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ICPManager />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/accounts"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Accounts />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/campaign-builder"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CampaignBuilder />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Leads />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/data-upload"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <DataUpload />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Settings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </ErrorBoundary>
          </TooltipProvider>
        </FeatureFlagsProvider>
      </OnboardingProvider>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
