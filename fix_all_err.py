import os
import re

# Pharmacist Workbench
filepath = 'apps/shopper-native/src/features/pharmacist/screens/WorkbenchScreen.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'router\.push\(\/\(pharmacist\)\/orders\/\)', 'router.push(/(pharmacist)/orders/)', content)
content = re.sub(r'router\.push\(\/\(pharmacist\)\/prescriptions\/\)', 'router.push(/(pharmacist)/prescriptions/)', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# HomeHero
filepath_hero = 'apps/shopper-native/src/features/home/components/HomeHero.tsx'
with open(filepath_hero, 'r', encoding='utf-8') as f:
    content_hero = f.read()

content_hero = re.sub(r't\("home\.heroGreetingNamed", Welcome back, \)', 't("home.heroGreetingNamed", Welcome back, )', content_hero)

with open(filepath_hero, 'w', encoding='utf-8') as f:
    f.write(content_hero)

