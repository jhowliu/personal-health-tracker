// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/alert.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Alert"],
          message: "Import Alert from '@/components/alert'; react-native-web's Alert.alert does nothing.",
        }],
      }],
    },
  },
]);
