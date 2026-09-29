/** Web only: draws the app inside an iPhone-sized frame, so the browser shows what a phone shows. */
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { FrameHostContext } from '@/components/frame-host';
import { color } from '@/theme/tokens';

// An iPhone 16 in CSS pixels. A smaller window shrinks the frame to fit.
const PHONE = { width: 393, height: 852 };

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  const attach = useCallback((node: View | null) => setHost(node as unknown as Element | null), []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.line,
      }}
    >
      <View
        ref={attach}
        style={{
          position: 'relative',
          width: PHONE.width,
          height: PHONE.height,
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          borderRadius: 32,
          backgroundColor: color.bg,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
        }}
      >
        <FrameHostContext.Provider value={host}>{children}</FrameHostContext.Provider>
      </View>
    </View>
  );
}
