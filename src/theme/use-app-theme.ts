import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppTheme, type AppColors } from './colors';

/** Resolved colour tokens for the active scheme. */
export function useAppTheme(): AppColors {
  const scheme = useColorScheme() ?? 'light';
  return AppTheme[scheme];
}

export function useIsDark(): boolean {
  return (useColorScheme() ?? 'light') === 'dark';
}

export type { AppColors };
