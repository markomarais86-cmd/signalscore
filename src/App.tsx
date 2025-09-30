import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/use-auth";
import { FeatureFlagsProvider } from "./hooks/use-feature-flags";
import { ThemeProvider } from "./components/ThemeProvider";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import PipelineEfficiency from "./pages/PipelineEfficiency";
import PersonaSegments from "./pages/PersonaSegments";
import CapitalEfficiency from "./pages/CapitalEfficiency";
import ICPManager from "./pages/ICPManager";
import { ICPTAMIntelligence } from "./pages/ICPTAMIntelligence";
import ICPAnalysisDashboard from "./pages/ICPAnalysisDashboard";
import Leads from "./pages/Leads";
import DataUpload from "./pages/DataUpload";
import AIAgents from "./pages/AIAgents";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <FeatureFlagsProvider>
            <TooltipProvider>
              <ErrorBoundary>
                <Toaster />
                <BrowserRouter>
              <Routes>
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
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pipeline"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PipelineEfficiency />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/personas"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PersonaSegments />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/capital"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CapitalEfficiency />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/icp-tam"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ICPTAMIntelligence />
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
                  path="/icp-analysis"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ICPAnalysisDashboard />
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
                  path="/ai-agents"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AIAgents />
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
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
