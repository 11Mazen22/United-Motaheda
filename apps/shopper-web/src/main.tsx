import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { configureApiClient } from "@pharmacy/api-client";
import { getSharedQueryClient } from "@pharmacy/domain-core";
import { useBrowserLocation } from "@pharmacy/domain-location";
import "./i18n";
import App from "./app/App";
import { publicEnv } from "./app/env";
import { AutoContrastTextGuard } from "./app/components/UI";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Toaster } from "./app/components/ui/sonner";
import "./styles/index.css";
import { reportWebVitals } from "./app/vitals";

configureApiClient({
  baseUrl: publicEnv.apiBase,
  searchApiBase: publicEnv.searchApiBase,
});

function LocationBootstrap() {
  useBrowserLocation(true);
  return null;
}

// M9: Start collecting Core Web Vitals immediately after the app boots.
// Metrics are logged to the console in dev; sent to VITE_VITALS_ENDPOINT in prod.
reportWebVitals();

// HMR guard: preserve the root reference across hot-module re-evaluations.
// Without this, every HMR cycle calls createRoot() on the same #root container,
// creating duplicate roots that race each other and cause removeChild crashes.
const container = document.getElementById("root")!;
const w = window as unknown as { __reactRoot?: ReactDOM.Root };
if (!w.__reactRoot) {
  w.__reactRoot = ReactDOM.createRoot(container);
}

w.__reactRoot.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={getSharedQueryClient()}>
        <LanguageProvider>
          <AuthProvider>
            <FavoritesProvider>
              <LocationBootstrap />
              <AutoContrastTextGuard />
              <App />
              <Toaster richColors position="top-right" />
            </FavoritesProvider>
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
