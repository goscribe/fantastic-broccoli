"use client";

import { useEffect, useState } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { toastError } from "@/lib/toast";
import { captureAttribution } from "@/lib/attribution";
import { reportSignupConversionFromUrl } from "@/lib/gtag";
import { captureInstallPrompt } from "@/lib/push-client";
import { useNewUi } from "@/lib/new-ui";
import "@/app/design/design.css";

/**
 * Toasts. The app is light by design, so they are too (the old toaster
 * followed the OS dark setting and showed a dark maroon error over a white
 * page). One quiet white card in the app's own tokens for every kind of
 * message; the icon carries the meaning, not a tinted background. They sit
 * below the top bar so they never cover the search field. The legacy
 * `?ui=old` screens keep their themed toaster.
 */
function ThemedToaster() {
  const { theme } = useTheme();
  const newUi = useNewUi();
  if (!newUi) return <Toaster richColors closeButton position="top-center" theme={theme} />;
  return (
    <Toaster
      closeButton
      position="top-center"
      theme="light"
      offset={{ top: 76 }}
      mobileOffset={{ top: 72 }}
      toastOptions={{
        classNames: {
          toast: "scribe-toast",
          title: "scribe-toast__title",
          description: "scribe-toast__description",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Capture where this visitor came from (utm_*/gclid/referrer) on their
  // first page view, so signup can attribute the account.
  useEffect(() => {
    captureAttribution();
    reportSignupConversionFromUrl();
    // Chrome's install prompt fires once, early; held until after a Quick 5.
    captureInstallPrompt();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
        // Any mutation without its own onError surfaces failures as a toast.
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.options.onError) return;
            toastError(error, "Something went wrong");
          },
        }),
      }),
  );

  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <ThemedToaster />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
