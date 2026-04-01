import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { RoleAwareLayout } from "./components/RoleAwareLayout";
import { FeatureFlaggedRoute } from "./components/FeatureFlaggedRoute";

// Lazy-loaded page components for code splitting
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const Landing = lazy(() => import("./pages/Landing"));
const About = lazy(() => import("./pages/About"));
const Product = lazy(() => import("./pages/Product"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Contact = lazy(() => import("./pages/Contact"));
const Demo = lazy(() => import("./pages/Demo"));
const Auth = lazy(() => import("./pages/Auth"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const DataProcessingAgreement = lazy(() => import("./pages/DataProcessingAgreement"));
const Security = lazy(() => import("./pages/Security"));
const Subprocessors = lazy(() => import("./pages/Subprocessors"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ICPManager = lazy(() => import("./pages/ICPManager"));
const Leads = lazy(() => import("./pages/Leads"));
const Accounts = lazy(() => import("./pages/Accounts"));
const DataUpload = lazy(() => import("./pages/DataUpload"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PipelineEfficiency = lazy(() => import("./pages/PipelineEfficiency"));
const CapitalEfficiency = lazy(() => import("./pages/CapitalEfficiency"));
const ReportBuilder = lazy(() => import("./pages/ReportBuilder"));
const Segmentation = lazy(() => import("./pages/Segmentation"));
const Trends = lazy(() => import("./pages/Trends"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const Enrichment = lazy(() => import("./pages/Enrichment"));

const AgentTester = lazy(() => import("./pages/AgentTester"));
const AITest = lazy(() => import("./pages/AITest"));
const Help = lazy(() => import("./pages/Help"));

const Tasks = lazy(() => import("./pages/Tasks"));
const CustomerOnboarding = lazy(() => import("./pages/admin/CustomerOnboarding"));
const ListBuilder = lazy(() => import("./pages/ListBuilder"));
const Presentations = lazy(() => import("./pages/Presentations"));

const Opportunities = lazy(() => import("./pages/Opportunities"));
const AIFeedbackPage = lazy(() => import("./pages/AIFeedbackPage"));
const BrandedLanding = lazy(() => import("./pages/BrandedLanding"));
const CustomerUpgrade = lazy(() => import("./pages/CustomerUpgrade"));
const PortfolioCommandCenter = lazy(() => import("./pages/PortfolioCommandCenter"));
const ValueCreationPlan = lazy(() => import("./pages/ValueCreationPlan"));
const DueDiligence = lazy(() => import("./pages/DueDiligence"));


// Shared loading fallback for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function PageTracker() {
  usePageTracking();
  return null;
}

/**
 * LandingRedirectWrapper - Shows Landing for guests, redirects authenticated users to dashboard
 */
function LandingRedirectWrapper() {
  const { user, loading } = useAuth();
  const { isSuperAdmin, isOrgAdmin, loading: rolesLoading } = useRoles();
  
  if (loading || rolesLoading) {
    return null;
  }
  
  if (user) {
    if (isSuperAdmin || isOrgAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/my-dashboard" replace />;
  }
  
  return <Landing />;
}

function AppContent() {
  const { startOnboarding } = useOnboarding();

  useEffect(() => {
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
        <Suspense fallback={<PageLoader />}>
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

            {/* Customer routes */}
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
              path="/my-dashboard"
              element={
                <ProtectedRoute>
                  <CustomerLayout>
                    <CustomerDashboard />
                  </CustomerLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin-only routes */}
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
            {/* PE/VC Portfolio routes - feature flagged */}
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FeatureFlaggedRoute flag="portfolio_management">
                      <PortfolioCommandCenter />
                    </FeatureFlaggedRoute>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/value-creation"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FeatureFlaggedRoute flag="portfolio_management">
                      <ValueCreationPlan />
                    </FeatureFlaggedRoute>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/due-diligence"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FeatureFlaggedRoute flag="portfolio_management">
                      <DueDiligence />
                    </FeatureFlaggedRoute>
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
            <Route path="/pipeline-analytics" element={<Navigate to="/pipeline-efficiency" replace />} />
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
            <Route path="/quick-enrich" element={<Navigate to="/enrichment" replace />} />
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
            <Route path="/api-access" element={<Navigate to="/settings?tab=api" replace />} />

            {/* Shared routes (role-aware) */}
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
              path="/help"
              element={
                <ProtectedRoute>
                  <RoleAwareLayout>
                    <Help />
                  </RoleAwareLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/presentations"
              element={
                <ProtectedRoute>
                  <RoleAwareLayout>
                    <Presentations />
                  </RoleAwareLayout>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

function App() {
  return (
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
  );
}

export default App;
