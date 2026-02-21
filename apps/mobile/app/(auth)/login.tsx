import { Redirect } from 'expo-router';
import { LoginScreen } from '../../src/screens/LoginScreen';
import { useMobileApp } from '../../src/contexts/MobileAppContext';

export default function LoginPage() {
  const { auth } = useMobileApp();

  if (auth.session) return <Redirect href="/(tabs)/overview" />;

  return <LoginScreen error={auth.error} authLoading={auth.authLoading} onLogin={auth.login} />;
}
