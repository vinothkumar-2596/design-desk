import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalSearchProvider } from "@/contexts/GlobalSearchContext";
import { TasksProvider } from "@/contexts/TasksContext";
import { Suspense, lazy } from "react";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewRequest = lazy(() => import("./pages/NewRequest"));
const Tasks = lazy(() => import("./pages/Tasks"));
const DesignerAvailability = lazy(() => import("./pages/DesignerAvailability"));
const MyRequests = lazy(() => import("./pages/MyRequests"));
const Drafts = lazy(() => import("./pages/Drafts"));
const Approvals = lazy(() => import("./pages/Approvals"));
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const Activity = lazy(() => import("./pages/Activity"));
const Settings = lazy(() => import("./pages/Settings"));
const Help = lazy(() => import("./pages/Help"));
const AIMode = lazy(() => import("./pages/AIMode"));
const WhatsAppTemplates = lazy(() => import("./pages/WhatsAppTemplates"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const EmailTask = lazy(() => import("./pages/EmailTask"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsService = lazy(() => import("./pages/TermsService"));
const DesignSystemCapture = lazy(() => import("./pages/DesignSystemCapture"));
const ResponsiveShowcaseCapture = lazy(() => import("./pages/ResponsiveShowcaseCapture"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TasksProvider>
          <GlobalSearchProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-service" element={<TermsService />} />
                    <Route path="/email-task" element={<EmailTask />} />
                    <Route path="/design-system-capture" element={<DesignSystemCapture />} />
                    <Route path="/responsive-showcase-capture" element={<ResponsiveShowcaseCapture />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/new-request" element={<NewRequest />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/designer-availability" element={<DesignerAvailability />} />
                    <Route path="/my-requests" element={<MyRequests />} />
                    <Route path="/drafts" element={<Drafts />} />
                    <Route path="/approvals" element={<Approvals />} />
                    <Route path="/task/:id" element={<TaskDetail />} />
                    <Route path="/tasks/:id" element={<TaskDetail />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/ai-mode" element={<AIMode />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/whatsapp-templates" element={<WhatsAppTemplates />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </GlobalSearchProvider>
        </TasksProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
