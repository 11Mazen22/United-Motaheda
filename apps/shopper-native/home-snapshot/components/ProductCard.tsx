import React from "react";
import { View, Text as RNText, Image, Pressable, StyleSheet } from "react-native";
import { Text as UIText } from "../shared/ui/Text";
import { theme } from "../shared/theme";
import { useCartStore } from "../stores/cart";
import { useWishlistStore } from "../stores/wishlist";
import type { NativeProduct } from "../features/products/types";

export function ProductCard({ product, onPress }: { product: NativeProduct; onPress?: () => void }) {
  const addItem = useCartStore((s: any) => s.addItem ?? (() => {}));
  const toggle = useWishlistStore((s: any) => s.toggle ?? (() => {}));
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.img} /> : null}
      <View style={styles.info}>
        <UIText style={styles.name}>{product.name}</UIText>
        <UIText style={styles.price}>{product.price ?? ""} ج.م</UIText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: 12, overflow: "hidden" },
  img: { width: "100%", height: 140, backgroundColor: theme.colors.surfaceSunken },
  info: { padding: 10 },
  name: { fontSize: 14 },
  price: { fontSize: 16, fontWeight: "700" },
});
