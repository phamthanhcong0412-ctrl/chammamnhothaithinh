/**
 * HOOK: useStoreConfig (ISP - Interface Segregation Principle)
 * Chuyên trách: Cấu hình cửa hàng, mạng WiFi, định vị GPS và thông tin mạng client.
 */

import { useApp } from '../context/AppContext.tsx';

export function useStoreConfig() {
  const {
    storeConfig,
    networkInfo,
    updateConfig,
    refreshData,
    isLoading,
  } = useApp();

  return {
    storeConfig,
    networkInfo,
    updateConfig,
    refreshConfig: refreshData,
    isLoading,
  };
}
