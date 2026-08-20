import os

filepath = 'apps/shopper-native/app/(customer)/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('Elevate{"\\n"}Your Health.', 'Elevate Your Health.')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
