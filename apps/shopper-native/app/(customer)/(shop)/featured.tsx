/**
 * Featured products screen ?" redirects to deals or products.
 * Expo Router requires a file for every registered route.
 */
import { Redirect } from "expo-router";
export default function FeaturedScreen() {
  return <Redirect href="/(customer)/(shop)/deals" />;
}
