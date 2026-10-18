import { createContext, useContext, type ReactNode } from 'react';
import {
  useCloudScope,
  type CloudScopeState,
} from '@/shell/useCloudScope';

const CloudScopeContext = createContext<CloudScopeState | null>(null);

export function CloudScopeProvider({
  sessionReady,
  children,
}: {
  sessionReady: boolean;
  children: ReactNode;
}) {
  const scope = useCloudScope(sessionReady);
  return (
    <CloudScopeContext.Provider value={scope}>
      {children}
    </CloudScopeContext.Provider>
  );
}

export function useCloudScopeContext(): CloudScopeState {
  const value = useContext(CloudScopeContext);
  if (!value) {
    throw new Error('useCloudScopeContext must be used within CloudScopeProvider');
  }
  return value;
}

/**
 * Pages that can degrade to a labeled preview when no scope provider exists
 * (standalone mounts, tests) read through this instead of throwing.
 */
export function useOptionalCloudScope(): CloudScopeState | null {
  return useContext(CloudScopeContext);
}
