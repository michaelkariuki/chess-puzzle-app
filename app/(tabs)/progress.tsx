import { useRouter } from 'expo-router';

import { ProgressScreen } from '@/src/screens/ProgressScreen';

export default function ProgressRoute() {
  const router = useRouter();
  return <ProgressScreen onStartPuzzle={() => router.push('/puzzle')} />;
}
