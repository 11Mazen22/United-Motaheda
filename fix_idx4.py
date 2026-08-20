import os

filepath = 'apps/shopper-native/app/(customer)/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('Elevate{"\\n"}Your Health.', 'Elevate Your Health.')
content = content.replace('Elevate{"\\r\\n"}Your Health.', 'Elevate Your Health.')
content = content.replace('Elevate{"\\n"}\nYour Health.', 'Elevate Your Health.')
content = content.replace('Elevate{"\\r\\n"}\r\nYour Health.', 'Elevate Your Health.')
content = content.replace('Elevate{"\n"}Your Health.', 'Elevate Your Health.')

# Let's just do a manual split and replace
lines = content.splitlines()
for i, line in enumerate(lines):
    if 'Elevate{"' in line:
        lines[i] = '                Elevate Your Health.'
    if '"}Your Health.' in line:
        lines[i] = ''

with open(filepath, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
