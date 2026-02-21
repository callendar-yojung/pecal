import { Redirect } from 'expo-router';
import { useApp } from '@/lib/app-context';

export default function Index() {
  const { state } = useApp();
  if (state.isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href={'/login' as any} />;
}
