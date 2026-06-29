import { useState, useCallback } from 'react';

export default function useLocalStorage(key, initialValue) {
  const [value, setValueState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((updater) => {
    setValueState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, [key]);

  return [value, setValue];
}
