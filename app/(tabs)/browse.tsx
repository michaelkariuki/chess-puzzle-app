import { useRouter } from 'expo-router';

import { BrowseScreen } from '@/src/screens/BrowseScreen';

export default function BrowseRoute() {
  const router = useRouter();
  return <BrowseScreen onOpenPuzzle={(id) => router.push(`/puzzle?id=${id}`)} />;
}
