import { useEffect, useState } from 'react';
import { GameLocaleContext, GAME_LOCALE_KEY, readGameLocale } from './GameLocaleContext.js';
import useStore from '../engine/store.js';

export default function GameLocaleProvider({ children }) {
  const [locale, updateLocale] = useState(readGameLocale);
  const setLocale = value => {
    const next = value === 'en' ? 'en' : 'zh';
    updateLocale(next);
    // Reuse the original Demo preference and update its live store as well.
    useStore.getState().setLocale(next);
  };
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    const sync = event => { if (event.key === GAME_LOCALE_KEY) updateLocale(readGameLocale()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [locale]);
  return <GameLocaleContext.Provider value={{ locale, setLocale }}>{children}</GameLocaleContext.Provider>;
}
