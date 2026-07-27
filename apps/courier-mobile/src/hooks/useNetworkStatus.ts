import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { queryClient } from '@/lib/queryClient';
import { showToast } from '@/components/ui/Toast';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? true;

      setIsConnected(connected);

      if (!connected) {
        setWasOffline(true);
        showToast('No internet connection', 'warning');
        // Pause query refetching while offline
        queryClient.setDefaultOptions({
          queries: { ...queryClient.getDefaultOptions().queries, enabled: false },
        });
      } else if (wasOffline) {
        // Just reconnected
        showToast('Back online — syncing…', 'success');
        setWasOffline(false);
        // Re-enable queries and invalidate stale data
        queryClient.setDefaultOptions({
          queries: { ...queryClient.getDefaultOptions().queries, enabled: true },
        });
        queryClient.invalidateQueries();
        queryClient.resumePausedMutations();
      }
    });

    return () => unsubscribe();
  }, [wasOffline]);

  return { isConnected };
}
