import { useRouter } from 'expo-router';

import { HomeScreen } from '@/src/screens/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();
  return (
    <HomeScreen
      onStartPuzzle={() => router.push('/puzzle')}
      onBrowse={() => router.push('/browse')}
      onViewProgress={() => router.push('/progress')}
    />
  );
}
