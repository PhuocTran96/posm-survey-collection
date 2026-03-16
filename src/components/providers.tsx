'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, createContext, useContext, useEffect, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  userid: string;
  username: string;
  loginid: string;
  role: string;
  leader: string | null;
  isSuperAdmin: boolean;
}

interface CustomSession {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

interface SessionContextType extends CustomSession {
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  status: 'loading',
  refreshSession: async () => {},
});

export function useCustomSession() {
  return useContext(SessionContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [session, setSession] = useState<CustomSession>({
    user: null,
    status: 'loading',
  });

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.authenticated && data.user) {
        setSession({
          user: data.user,
          status: 'authenticated',
        });
      } else {
        setSession({
          user: null,
          status: 'unauthenticated',
        });
      }
    } catch (error) {
      console.error('Session fetch error:', error);
      setSession({
        user: null,
        status: 'unauthenticated',
      });
    }
  }, []);

  useEffect(() => {
    // Fetch session data on mount
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchSession();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchSession]);

  return (
    <SessionContext.Provider value={{ ...session, refreshSession: fetchSession }}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </SessionContext.Provider>
  );
}
