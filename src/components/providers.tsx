'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';

/**
 * Providers component wraps the application with necessary context providers.
 * Here we are setting up TanStack Query's QueryClientProvider.
 * 
 * We create the QueryClient inside the component using useState to ensure
 * that the client is only created once per application lifecycle on the client side,
 * preventing data loss during re-renders or hydration mismatches.
 */
export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
