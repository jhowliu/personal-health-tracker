/**
 * Text and TextInput in the app's typeface. Import these instead of react-native's: a native
 * Text does not inherit a font from the View around it, so every one has to be given it.
 *
 * Huninn has a single weight. Hierarchy comes from size and colour, so do not add font-bold
 * or font-semibold: a platform would fake the weight, or fall back to the system font.
 */
import { forwardRef } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

export const FONT_FAMILY = 'Huninn_400Regular';

const face = { fontFamily: FONT_FAMILY };

export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  return <NativeText ref={ref} style={[face, style]} {...props} />;
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  return <NativeTextInput ref={ref} style={[face, style]} {...props} />;
});
