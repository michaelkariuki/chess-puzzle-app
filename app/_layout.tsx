import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { PuzzleProvider } from '@/src/state/PuzzleContext';
import { AppTheme } from '@/src/theme/colors';

export const unstable_settings = {
  anchor: '(tabs)',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Puzzles are immutable once fetched, so there is nothing to revalidate.
      staleTime: Infinity,
    },
  },
});

export default function RootLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = AppTheme[scheme];

  // Feed our palette to React Navigation so headers and card backgrounds match
  // the app rather than defaulting to stark white/black.
  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PuzzleProvider>
          <ThemeProvider value={navTheme}>
            <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="puzzle"
                options={{ title: 'Puzzle', headerBackTitle: 'Home' }}
              />
              <Stack.Screen
                name="modal"
                options={{ presentation: 'modal', title: 'About' }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </PuzzleProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
