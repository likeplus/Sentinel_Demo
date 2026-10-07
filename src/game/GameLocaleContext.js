import { createContext, useContext } from 'react';
import { localizeGameText } from './localization.js';

export const GAME_LOCALE_KEY = 'sentinel_locale_v1';
export const GameLocaleContext = createContext({ locale: 'zh', setLocale: () => {} });
export const readGameLocale = () => {
  try { return globalThis.localStorage?.getItem(GAME_LOCALE_KEY) === 'en' ? 'en' : 'zh'; }
  catch { return 'zh'; }
};
export function useGameLocale() {
  const context = useContext(GameLocaleContext);
  return { ...context, t: value => localizeGameText(context.locale, value) };
}
