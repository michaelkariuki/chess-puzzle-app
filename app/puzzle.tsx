import { useLocalSearchParams, useRouter } from 'expo-router';

import { PuzzleScreen } from '@/src/screens/PuzzleScreen';

export default function PuzzleRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <PuzzleScreen
      puzzleId={typeof id === 'string' && id.length > 0 ? id : undefined}
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
