import os

# HomeHero
filepath_hero = 'apps/shopper-native/src/features/home/components/HomeHero.tsx'
with open(filepath_hero, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 't("home.heroGreetingNamed", Welcome back, )' in line:
        lines[i] = '            {firstName ? t("home.heroGreetingNamed", Welcome back, ) : t("home.heroGreeting", "Welcome to United")}\n'

with open(filepath_hero, 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Pharmacist Workbench
filepath_work = 'apps/shopper-native/src/features/pharmacist/screens/WorkbenchScreen.tsx'
with open(filepath_work, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'router.push(/(pharmacist)/orders/)' in line:
        lines[i] = '                <OrderQueueCard order={o} onPress={() => router.push(/(pharmacist)/orders/)} />\n'
    if 'router.push(/(pharmacist)/prescriptions/)' in line:
        lines[i] = '                <Pressable style={s.rxCard} onPress={() => router.push(/(pharmacist)/prescriptions/)}>\n'

with open(filepath_work, 'w', encoding='utf-8') as f:
    f.writelines(lines)

