import { createContext } from 'react';

/**
 * The DOM node of the web phone frame, so modals can be drawn inside it instead of over the
 * whole browser window. Always null on native, where there is no frame.
 */
export const FrameHostContext = createContext<Element | null>(null);
