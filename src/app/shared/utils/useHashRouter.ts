import { useState, useEffect } from 'react';

/**
 * A lightweight custom router hook that synchronizes internal screen state with the browser's URL hash.
 * This fixes the SPA back button issue without needing react-router-dom.
 * 
 * @param prefix The root path for this router (e.g., "teacher", "student")
 * @param defaultScreen The fallback screen if the hash is empty or invalid
 */
export function useHashRouter<T extends string>(prefix: string, defaultScreen: T): [T, (s: T) => void] {
  // Read initial hash synchronously
  const getHashScreen = (): T => {
    const hash = window.location.hash.replace('#/', '');
    if (hash.startsWith(prefix + '/')) {
      const s = hash.replace(prefix + '/', '') as T;
      return s || defaultScreen;
    }
    return defaultScreen;
  };

  const [screen, setScreenState] = useState<T>(getHashScreen);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '');
      if (hash.startsWith(prefix + '/')) {
        const s = hash.replace(prefix + '/', '') as T;
        if (s !== screen) setScreenState(s);
      } else if (hash === prefix || hash === '') {
        // If they navigate to just #/teacher or root, reset to default screen
        if (screen !== defaultScreen) setScreenState(defaultScreen);
      }
    };

    window.addEventListener('hashchange', handleHash);
    // Push the current state to the URL right away to ensure consistency
    if (!window.location.hash.startsWith(`#/${prefix}/`)) {
        window.history.replaceState(null, '', `#/${prefix}/${screen}`);
    }
    return () => window.removeEventListener('hashchange', handleHash);
  }, [prefix, defaultScreen, screen]);

  const setScreen = (s: T) => {
    // If the hash matches exactly, don't push state (prevents duplicate history entries)
    if (window.location.hash !== `#/${prefix}/${s}`) {
        window.location.hash = `/${prefix}/${s}`;
    }
    setScreenState(s);
  };

  return [screen, setScreen];
}
