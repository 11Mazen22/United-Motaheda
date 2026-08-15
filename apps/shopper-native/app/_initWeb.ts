/**
 * Native runtime shim companion for _initWeb.web.ts.
 *
 * Expo/Metro resolves the .web.ts implementation only for web builds.
 * Native platforms use this no-op module so the web bootstrap never imports
 * browser-only or react-native-web internals into native bundles.
 */
export default function NativeInitWeb(): null {
  return null;
}
