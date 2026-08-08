"use client";

import { useEffect, useState } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { toastError } from "@/lib/toast";
import { captureAttribution } from "@/lib/attribution";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster richColors closeButton position="top-center" theme={theme} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Capture where this visitor came from (utm_*/gclid/referrer) on their
  // first page view, so signup can attribute the account.
  useEffect(() => {
    captureAttribution();
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
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
