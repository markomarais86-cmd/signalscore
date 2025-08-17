import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import PipelineEfficiency from "./pages/PipelineEfficiency";
import PersonaSegments from "./pages/PersonaSegments";
import CapitalEfficiency from "./pages/CapitalEfficiency";
import ICPManager from "./pages/ICPManager";
import Leads from "./pages/Leads";
import DataUpload from "./pages/DataUpload";
import AIAgents from "./pages/AIAgents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Index />
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
                    <ICPManager />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/signal-index"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DataUpload />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
