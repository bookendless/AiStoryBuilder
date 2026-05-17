import { useState, useCallback } from 'react';
import { ErrorInfo } from '../types/errors';
import { checkLocalLLMConnectivity } from '../services/providers/local';

interface ProviderFallbackState {
  error: ErrorInfo | null;
  isFallbackAvailable: boolean;
  isCheckingFallback: boolean;
}

const FALLBACK_CHECKABLE_CATEGORIES = new Set([
  'rate_limit',
  'quota_exceeded',
  'network',
  'server_error',
]);

export function useAIProviderFallback(
  settings: { provider: string; localEndpoint?: string },
  onSwitchToLocal: () => void
): {
  fallbackState: ProviderFallbackState;
  handleAIError: (error: ErrorInfo) => void;
  dismissError: () => void;
  retryFallback: () => void;
} {
  const [fallbackState, setFallbackState] = useState<ProviderFallbackState>({
    error: null,
    isFallbackAvailable: false,
    isCheckingFallback: false,
  });

  const handleAIError = useCallback(async (error: ErrorInfo) => {
    setFallbackState({
      error,
      isFallbackAvailable: false,
      isCheckingFallback: FALLBACK_CHECKABLE_CATEGORIES.has(error.category),
    });

    if (!FALLBACK_CHECKABLE_CATEGORIES.has(error.category)) {
      return;
    }

    const endpoint = settings.localEndpoint;
    if (!endpoint) {
      setFallbackState(prev => ({ ...prev, isCheckingFallback: false }));
      return;
    }

    try {
      const available = await checkLocalLLMConnectivity(endpoint);
      setFallbackState(prev => ({
        ...prev,
        isFallbackAvailable: available,
        isCheckingFallback: false,
      }));
    } catch {
      setFallbackState(prev => ({
        ...prev,
        isFallbackAvailable: false,
        isCheckingFallback: false,
      }));
    }
  }, [settings.localEndpoint]);

  const dismissError = useCallback(() => {
    setFallbackState({
      error: null,
      isFallbackAvailable: false,
      isCheckingFallback: false,
    });
  }, []);

  const retryFallback = useCallback(() => {
    onSwitchToLocal();
    setFallbackState({
      error: null,
      isFallbackAvailable: false,
      isCheckingFallback: false,
    });
  }, [onSwitchToLocal]);

  return { fallbackState, handleAIError, dismissError, retryFallback };
}
