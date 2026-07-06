import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
// @ts-expect-error - JS module
import App from "../App.jsx";
// @ts-expect-error - JS module
import { AuthProvider } from "../context/AuthContext.jsx";
// @ts-expect-error - JS module
import { NotificationProvider } from "../context/NotificationContext.jsx";
import ChatWidget from "../components/ChatWidget";

/**
 * The Taskflow app is a client-rendered SPA (localStorage auth, sockets, axios
 * to the geoq backend). We mount it only after hydration so SSR never touches
 * browser-only APIs, while TanStack Start still owns the document shell.
 */
export default function SpaApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 text-ink-faint">
          <span className="h-2.5 w-2.5 animate-flow-dot rounded-full bg-flow" />
          <span className="font-mono text-xs uppercase tracking-widest">Loading Taskflow</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
          <ChatWidget />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
