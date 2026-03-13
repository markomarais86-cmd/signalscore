import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/use-auth";
import { FeatureFlagsProvider } from "./hooks/use-feature-flags";
import { OnboardingProvider } from "./hooks/use-onboarding";
import { CampaignContextProvider } from "./hooks/use-campaign-context";
import { OrgSwitcherProvider } from "./contexts/OrgSwitcherContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { Layout } from "./components/Layout";
import { CustomerLayout } from "./components/CustomerLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { useEffect } from "react";
import { useAuth } from "./hooks/use-auth";
import { useOnboarding } from "./hooks/use-onboarding";
import { useRoles } from "./hooks/use-roles";
import { usePageTracking } from "./hooks/usePageTracking";
import { logger } from "./lib/logger";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Product from "./pages/Product";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Demo from "./pages/Demo";
import Auth from "./pages/Auth";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DataProcessingAgreement from "./pages/DataProcessingAgreement";
import Security from "./pages/Security";
import Subprocessors from "./pages/Subprocessors";
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
import CustomerDashboard from "./pages/CustomerDashboard";
import { RoleAwareLayout } from "./components/RoleAwareLayout";
import Enrichment from "./pages/Enrichment";
import QuickEnrich from "./pages/QuickEnrich";
import AgentTester from "./pages/AgentTester";
import AITest from "./pages/AITest";
import Help from "./pages/Help";
import APIAccess from "./pages/APIAccess";
import Tasks from "./pages/Tasks";
import CustomerOnboarding from "./pages/admin/CustomerOnboarding";
import ListBuilder from "./pages/ListBuilder";
import Presentations from "./pages/Presentations";

import PipelineAnalyticsPage from "./pages/PipelineAnalyticsPage";
import Opportunities from "./pages/Opportunities";
import AIFeedbackPage from "./pages/AIFeedbackPage";
import BrandedLanding from "./pages/BrandedLanding";
import CustomerUpgrade from "./pages/CustomerUpgrade";
import PortfolioCommandCenter from "./pages/PortfolioCommandCenter";

const queryClient = new QueryClient();

function PageTracker() {
  usePageTracking();
  return null;
}

/**
 * LandingRedirectWrapper - Shows Landing for guests, redirects authenticated users to dashboard
 * This ensures "/" shows the marketing page for SEO while maintaining app functionality
 */
function LandingRedirectWrapper() {
  const { user, loading } = useAuth();
  const { isSuperAdmin, isOrgAdmin, loading: rolesLoading } = useRoles();
  
  // While loading, show nothing (prevents flash)
  if (loading || rolesLoading) {
    return null;
  }
  
  // Authenticated users go to appropriate dashboard
  if (user) {
    if (isSuperAdmin || isOrgAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/my-dashboard" replace />;
  }
  
  // Unauthenticated users see the landing page
  return <Landing />;
}

function AppContent() {
  const { startOnboarding } = useOnboarding();

  useEffect(() => {
    // Check if we should trigger onboarding wizard
    const showOnboarding = localStorage.getItem('show_onboarding');
    if (showOnboarding === 'true') {
      logger.debug('Triggering onboarding wizard');
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
        <PageTracker />
        <OnboardingWizard />
        <Routes>
                {/* Public Marketing Pages */}
                <Route path="/" element={<LandingRedirectWrapper />} />
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/about" element={<About />} />
                <Route path="/product" element={<Product />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/demo" element={<Demo />} />
                
                {/* Auth Pages */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/dpa" element={<DataProcessingAgreement />} />
                <Route path="/security" element={<Security />} />
                <Route path="/subprocessors" element={<Subprocessors />} />
                <Route path="/p/:orgSlug" element={<BrandedLanding />} />
                <Route
                  path="/upgrade"
                  element={
                    <ProtectedRoute>
                      <CustomerLayout>
                        <CustomerUpgrade />
                      </CustomerLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ExecutiveDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-dashboard"
                  element={
                    <ProtectedRoute>
                      <CustomerLayout>
                        <CustomerDashboard />
                      </CustomerLayout>
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
                      <RoleAwareLayout>
                        <Leads />
                      </RoleAwareLayout>
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
                      <RoleAwareLayout>
                        <Settings />
                      </RoleAwareLayout>
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
                  path="/admin/customer-onboarding"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CustomerOnboarding />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/customer-onboarding/:orgId"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CustomerOnboarding />
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
                  path="/opportunities"
                  element={
                    <ProtectedRoute>
                      <RoleAwareLayout>
                        <Opportunities />
                      </RoleAwareLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pipeline-analytics"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PipelineAnalyticsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ai-feedback"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AIFeedbackPage />
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
                <Route
                  path="/enrichment"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Enrichment />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quick-enrich"
                  element={
                    <ProtectedRoute>
                      <Layout>
                      <QuickEnrich />
                    </Layout>
                  </ProtectedRoute>
                }
              />
                <Route
                  path="/list-builder"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ListBuilder />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                {/* Test routes - only available in development */}
                {import.meta.env.DEV && (
                  <>
                    <Route
                      path="/agent-tester"
                      element={
                        <ProtectedRoute>
                          <Layout>
                            <AgentTester />
                          </Layout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ai-test"
                      element={
                        <ProtectedRoute>
                          <Layout>
                            <AITest />
                          </Layout>
                        </ProtectedRoute>
                      }
                    />
                  </>
                )}
                <Route
                  path="/discovery"
                  element={<Navigate to="/icp-manager" replace />}
                />
                <Route
                  path="/help"
                  element={
                    <ProtectedRoute>
                      <Help />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute>
                      <RoleAwareLayout>
                        <Tasks />
                      </RoleAwareLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/api-access"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <APIAccess />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/presentations"
                  element={
                    <ProtectedRoute>
                      <Presentations />
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
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="launchpulse-theme">
        <AuthProvider>
          <OrgSwitcherProvider>
            <OnboardingProvider>
              <CampaignContextProvider>
                <FeatureFlagsProvider>
                <TooltipProvider>
                  <ErrorBoundary>
                    <AppContent />
                  </ErrorBoundary>
                </TooltipProvider>
                </FeatureFlagsProvider>
              </CampaignContextProvider>
            </OnboardingProvider>
          </OrgSwitcherProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
