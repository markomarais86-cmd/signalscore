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
import { useEffect } from "react";
import { useOnboarding } from "./hooks/use-onboarding";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ICPManager from "./pages/ICPManager";
import Leads from "./pages/Leads";
import Accounts from "./pages/Accounts";
import DataUpload from "./pages/DataUpload";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import PipelineEfficiency from "./pages/PipelineEfficiency";
import CapitalEfficiency from "./pages/CapitalEfficiency";
import ReportBuilder from "./pages/ReportBuilder";
import Segmentation from "./pages/Segmentation";
import Trends from "./pages/Trends";
import NotFound from "./pages/NotFound";
import AIAgents from "./pages/AIAgents";

const queryClient = new QueryClient();

function AppContent() {
  const { startOnboarding } = useOnboarding();

  useEffect(() => {
    // Check if we should trigger onboarding wizard
    const showOnboarding = localStorage.getItem('show_onboarding');
    if (showOnboarding === 'true') {
      console.log('Triggering onboarding wizard');
      startOnboarding();
      localStorage.removeItem('show_onboarding');
    }
  }, [startOnboarding]);

  return (
    <>
      <Toaster />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
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
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pipeline-efficiency"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PipelineEfficiency />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/capital-efficiency"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CapitalEfficiency />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ReportBuilder />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/segmentation"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Segmentation />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                 <Route
                  path="/trends"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Trends />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ai-agents"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AIAgents />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <OnboardingProvider>
            <FeatureFlagsProvider>
              <TooltipProvider>
                <ErrorBoundary>
                  <AppContent />
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
