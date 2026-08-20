import os

filepath = 'apps/shopper-native/app/(auth)/register.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { useAuth } from "@/features/auth";', 'import { useAuth, signUp, getAuthError } from "@/features/auth";')
content = content.replace('import { register, getAuthError } from "@/features/auth";', '')
content = content.replace('await register(', 'await signUp(')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
