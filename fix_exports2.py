import os
import re

# 1. apps/shopper-native/app/(customer)/(account)/order/track/[id].tsx
f1 = 'apps/shopper-native/app/(customer)/(account)/order/track/[id].tsx'
content1 = open(f1, 'r', encoding='utf-8').read()
content1 = content1.replace('export { TrackOrderScreen as default } from', 'export { default } from')
with open(f1, 'w', encoding='utf-8') as f: f.write(content1)

# 2. apps/shopper-native/app/(customer)/(shop)/deals.tsx
f3 = 'apps/shopper-native/app/(customer)/(shop)/deals.tsx'
content3 = open(f3, 'r', encoding='utf-8').read()
content3 = content3.replace('import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";', 'import { ProductCard } from "@/components/ProductCard";')
with open(f3, 'w', encoding='utf-8') as f: f.write(content3)

# 3. apps/shopper-native/src/features/home/components/FeaturedSection.tsx
f4 = 'apps/shopper-native/src/features/home/components/FeaturedSection.tsx'
content4 = open(f4, 'r', encoding='utf-8').read()
content4 = content4.replace('import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";', 'import { ProductCard } from "@/components/ProductCard";')
with open(f4, 'w', encoding='utf-8') as f: f.write(content4)

