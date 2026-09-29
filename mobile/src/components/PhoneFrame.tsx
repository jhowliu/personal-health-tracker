/** On a phone the screen is already phone-sized. PhoneFrame.web.tsx draws the frame in a browser. */
import type { ReactNode } from 'react';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
