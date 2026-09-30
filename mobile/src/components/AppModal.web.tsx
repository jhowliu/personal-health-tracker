/**
 * Web stand-in for react-native's Modal. The real one covers the whole browser window, so a
 * sheet would spill out of the phone frame; this one is drawn inside it. There is no slide
 * animation, and Escape closes it the way the Android back button does.
 */
import { useContext, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { View } from 'react-native';

import { FrameHostContext } from '@/components/frame-host';

export function AppModal({
  visible,
  onRequestClose,
  children,
}: {
  visible?: boolean;
  onRequestClose?: () => void;
  children?: ReactNode;
  // Accepted so call sites match the native Modal; none of them matter in a browser.
  transparent?: boolean;
  statusBarTranslucent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
}) {
  const host = useContext(FrameHostContext);

  useEffect(() => {
    if (!visible || !onRequestClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onRequestClose]);

  if (!visible || !host) return null;
  return createPortal(
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000 }}>
      {children}
    </View>,
    host,
  );
}
