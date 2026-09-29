// react-dom ships no types and the app does not depend on @types/react-dom. Only the web phone
// frame needs it, for the one portal in src/components/AppModal.web.tsx.
declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react';

  export function createPortal(children: ReactNode, container: Element): ReactPortal;
}
