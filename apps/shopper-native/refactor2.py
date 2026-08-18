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

# We also need to fix any .styles.ts if they are in the same folder, but the prompt says 10 target screens.

def refactor():
    for filepath in SCREENS:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        orig = content
        
        # 1. Imports
        if "useDarkColors" not in content:
            # find first react native or react import
            content = re.sub(r"(import .*?from ['\"]react(?:-native)?['\"];?)", r"\1\nimport { useDarkColors } from '@/hooks/useDarkColors';", content, count=1)

        # 2. design-tokens
        content = re.sub(r"import\s+\{\s*theme(?:,\s*legacyColors)?\s*\}\s+from\s+['\"]@pharmacy/design-tokens['\"];?\n?", "", content)
        
        # If kit not imported
        if "import { kit }" not in content and "kit." in content:
            content = re.sub(r"(import .*?from ['\"]@pharmacy/ui-native['\"];?)", r"\1\nimport { kit } from '@pharmacy/ui-native';", content, count=1)
            # fallback
            if "import { kit }" not in content:
                content = "import { kit } from '@pharmacy/ui-native';\n" + content

        # 3. Add `const { c } = useDarkColors();` to all components
        # match function ComponentName(...) {
        def repl(m):
            # check if it already has the hook
            if "useDarkColors" in m.group(0):
                return m.group(0)
            return m.group(1) + "\n  const { c } = useDarkColors();\n"

        content = re.sub(r"((?:export\s+(?:default\s+)?)?function\s+[A-Z][A-Za-z0-9_]*\s*\([^)]*\)\s*\{)", repl, content)
        
        # match const ComponentName = memo(function ComponentName(...) {
        # match const ComponentName = function(...) {
        # match const ComponentName = (...) => {
        content = re.sub(r"(const\s+[A-Z][A-Za-z0-9_]*\s*=\s*(?:memo\()?(?:function\s*[A-Za-z0-9_]*\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{)", repl, content)

        # 4. Color replacements inside the file
        content = re.sub(r"kit\.color\.([a-zA-Z0-9_]+)", r"c.\1", content)
        content = re.sub(r"legacyColors\.([a-zA-Z0-9_]+)", r"c.\1", content)
        content = re.sub(r"theme\.spacing\.([a-zA-Z0-9_]+)", r"kit.sp(4)", content) # Just an approximation for theme.spacing

        # 5. RTL Replacements
        rtl_repl = {
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
        for old, new in rtl_repl.items():
            content = re.sub(old, new, content)
            
        # 6. console.log
        content = re.sub(r"console\.log\([^)]*\);?\n?", "", content)

        if content != orig:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Updated {filepath}")

if __name__ == "__main__":
    refactor()
