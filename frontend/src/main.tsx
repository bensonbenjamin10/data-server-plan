import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ApiProvider } from "./lib/api-context";
import { ToastProvider } from "./components/ui/Toast";
import "./styles/tokens.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Explicit redirect URLs so Clerk knows where to go after sign-in (fixes stuck loading)
const clerkPaths = {
  signInFallbackRedirectUrl: "/",
  signUpFallbackRedirectUrl: "/",
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={clerkPubKey || "pk_test_placeholder"}
      {...clerkPaths}
    >
      <ApiProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </ToastProvider>
      </ApiProvider>
    </ClerkProvider>
  </React.StrictMode>
);
