import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/auth/session';
import { color } from '@/theme/tokens';

export default function Entry() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (status === 'newUser') return <Redirect href="/profile-setup" />;
  return <Redirect href="/today" />;
}
