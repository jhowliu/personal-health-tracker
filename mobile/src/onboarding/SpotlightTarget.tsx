import { useCallback, useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useOnboarding } from './OnboardingProvider';
import type { TourTargetId } from './tour';

export function SpotlightTarget({
  id,
  children,
  activate,
  radius,
  className = '',
  style,
}: {
  id: TourTargetId;
  children: ReactNode;
  activate?: () => void;
  radius?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { registerTarget, refreshTarget } = useOnboarding();
  const attach = useCallback(
    (node: View | null) => {
      registerTarget(id, node, { activate, radius });
    },
    [id, activate, radius, registerTarget],
  );

  useEffect(
    () => () => {
      registerTarget(id, null);
    },
    [id, registerTarget],
  );

  return (
    <View
      ref={attach}
      collapsable={false}
      className={className}
      style={style}
      onLayout={refreshTarget}
    >
      {children}
    </View>
  );
}
