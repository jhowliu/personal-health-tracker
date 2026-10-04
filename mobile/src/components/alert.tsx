/**
 * react-native's Alert, re-exported so every screen imports it from here. alert.web.tsx stands
 * in for it in a browser, where react-native-web's Alert.alert does nothing.
 */
export { Alert } from 'react-native';

/** Nothing to mount on a phone: the system draws the dialog. */
export function AlertHost() {
  return null;
}
