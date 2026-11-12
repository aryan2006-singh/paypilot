import { HashRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { MobileTabBar, MobileTopBar } from "./components/MobileNav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EmptyState } from "./components/States";
import { OfflineBanner } from "./components/OfflineBanner";
import { ModeBanner } from "./components/ModeBanner";
import { Dashboard } from "./pages/Dashboard";
import { Chat } from "./pages/Chat";
import { Agents } from "./pages/Agents";
import { Settings } from "./pages/Settings";
import { Landing } from "./pages/Landing";
import { Conversations } from "./pages/Conversations";
import { ScrollToTop } from "./components/ScrollToTop";

function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      body="That page doesn't exist. Head back to the dashboard to keep going."
      action={
        <Link to="/app" className="brand-gradient inline-flex h-10 items-center rounded-lg px-4 text-[13.5px] font-semibold text-white">
          Go to dashboard
        </Link>
      }
    />
  );
}

function Shell() {
  const { pathname } = useLocation();
  const isChat = pathname.startsWith("/app/chat");

  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] font-medium shadow-[var(--shadow-md)] focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <OfflineBanner />
        <ModeBanner />
        <main
          id="main"
          tabIndex={-1}
          className={`flex-1 px-8 py-7 max-lg:px-6 max-md:px-4 max-md:py-5 ${
            isChat ? "overflow-hidden max-md:pb-[76px]" : "overflow-y-auto max-md:pb-24"
          }`}
        >
          <div className={`mx-auto h-full w-full ${isChat ? "max-w-[920px]" : "max-w-[1200px]"}`}>
            <ErrorBoundary key={pathname}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="chat" element={<Chat />} />
                <Route path="history" element={<Conversations />} />
                <Route path="agents" element={<Agents />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}

function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<Shell />} />
        {/* Old console links (#/chat, #/agents, #/settings) keep working. */}
        <Route path="/chat" element={<LegacyRedirect to="/app/chat" />} />
        <Route path="/agents" element={<Navigate to="/app/agents" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
