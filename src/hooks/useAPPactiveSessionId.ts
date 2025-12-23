import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppActiveSessionId() {
  const [sessionId, setSessionId] = useState(1);

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;

    const sub = AppState.addEventListener('change', (next) => {
      const wasBg = prev === 'background' || prev === 'inactive';
      const isActive = next === 'active';
      prev = next;

      // ✅ 每次「打開 app / 回到前景」只觸發一次
      if (wasBg && isActive) {
        setSessionId((s) => s + 1);
      }
    });

    return () => sub.remove();
  }, []);

  return sessionId;
}
