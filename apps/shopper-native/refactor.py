import os
import re

SCREENS = [
    "app/(tabs)/cart.tsx",
    "app/(tabs)/products.tsx",
    "app/(tabs)/profile.tsx",
    "app/addresses.tsx",
    "app/payment.tsx",
    "app/orders.tsx",
    "app/order/[id].tsx",
    "app/order/track/[id].tsx",
    "app/favorites.tsx",
    "app/notifications.tsx",
]

RTL_REPLACEMENTS = {
    r'\bleft\s*:': 'start:',
    r'\bright\s*:': 'end:',
    r'\bmarginLeft\s*:': 'marginStart:',
    r'\bmarginRight\s*:': 'marginEnd:',
    r'\bpaddingLeft\s*:': 'paddingStart:',
    r'\bpaddingRight\s*:': 'paddingEnd:',
    r'\bborderLeftWidth\s*:': 'borderStartWidth:',
    r'\bborderRightWidth\s*:': 'borderEndWidth:',
    r'\bborderTopLeftRadius\s*:': 'borderTopStartRadius:',
    r'\bborderTopRightRadius\s*:': 'borderTopEndRadius:',
    r'\bborderBottomLeftRadius\s*:': 'borderBottomStartRadius:',
    r'\bborderBottomRightRadius\s*:': 'borderBottomEndRadius:',
}

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 1. Remove console.logs
    content = re.sub(r'console\.log\([^)]*\);?\n?', '', content)

    # 2. Add imports
    if 'useDarkColors' not in content:
        content = re.sub(r"(import React.*?from ['\"]react['\"];?)", r"\1\nimport { useDarkColors } from '@/hooks/useDarkColors';", content, count=1)
        if 'useDarkColors' not in content: # fallback
            content = "import { useDarkColors } from '@/hooks/useDarkColors';\n" + content

    if 'import { kit }' not in content and 'kit.' in content:
        content = re.sub(r"(import .*?from ['\"]react-native['\"];?)", r"\1\nimport { kit } from '@pharmacy/ui-native';", content, count=1)

    # 3. Replace @pharmacy/design-tokens usages
    content = re.sub(r"import\s+\{\s*theme(?:,\s*legacyColors)?\s*\}\s+from\s+['\"]@pharmacy/design-tokens['\"];?\n?", "", content)

    # 4. Inject hook usage into component definitions
    # Find all component definitions (export default function X() { or const X = () => {)
    comp_pattern = r'(export\s+(?:default\s+)?function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)'
    def inject_hook(match):
        return match.group(1) + '\n  const { c, isDark } = useDarkColors();\n'
    
    new_content = re.sub(comp_pattern, inject_hook, content)
    if new_content == content:
        comp_pattern2 = r'(const\s+[A-Za-z0-9_]+\s*=\s*(?:memo\()?function\s*[A-Za-z0-9_]*\s*\([^)]*\)\s*\{)'
        new_content = re.sub(comp_pattern2, inject_hook, content)
    content = new_content

    # 5. RTL Replacements
    for old, new in RTL_REPLACEMENTS.items():
        content = re.sub(old, new, content)

    # 6. Colors: kit.color.X -> c.X, legacyColors.X -> c.X
    content = re.sub(r'kit\.color\.([a-zA-Z0-9_]+)', r'c.\1', content)
    content = re.sub(r'legacyColors\.([a-zA-Z0-9_]+)', r'c.\1', content)
    
    # Write back
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes for {filepath}")

for screen in SCREENS:
    process_file(screen)

print("Done screens.")
