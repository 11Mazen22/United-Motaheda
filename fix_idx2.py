import os
import re

filepath = 'apps/shopper-native/app/(customer)/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'Elevate\{"[\\r\\n]+"\}Your Health.', 'Elevate Your Health.', content, flags=re.MULTILINE)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
