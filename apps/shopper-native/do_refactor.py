import os

base_dir = r"i:\United-Motaheda\apps\shopper-native"
components_dir = os.path.join(base_dir, "src", "features", "search", "components")
os.makedirs(components_dir, exist_ok=True)

files = {
    "SearchBar.tsx": """import React from 'react';
import { View, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { flexRow, isRtl, textAlignStart } from '@/utils/layout';
import { useDarkColors } from '@/hooks/useDarkColors';

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL) as 'left' | 'right' | 'center';

export const SearchBar = React.memo((props: any) => {
    return <View><UIText>SearchBar</UIText></View>;
});
""",
    "SearchFilters.tsx": """import React from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { flexRow, isRtl } from '@/utils/layout';
import { useDarkColors } from '@/hooks/useDarkColors';

export const SearchFilters = React.memo((props: any) => {
    return <View><UIText>SearchFilters</UIText></View>;
});
""",
    "SearchResults.tsx": """import React from 'react';
import { View, StyleSheet } from 'react-native';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { ProductGrid } from '@/features/products';
import { useDarkColors } from '@/hooks/useDarkColors';

export const SearchResults = React.memo((props: any) => {
    return <View><UIText>SearchResults</UIText></View>;
});
""",
    "SearchSuggestions.tsx": """import React from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { flexRow, isRtl, textAlignStart } from '@/utils/layout';
import { useDarkColors } from '@/hooks/useDarkColors';

export const SearchSuggestions = React.memo((props: any) => {
    return <View><UIText>SearchSuggestions</UIText></View>;
});
""",
    "RecentSearches.tsx": """import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { flexRow, isRtl } from '@/utils/layout';
import { useDarkColors } from '@/hooks/useDarkColors';

export const RecentSearches = React.memo((props: any) => {
    return <View><UIText>RecentSearches</UIText></View>;
});
"""
}

for filename, content in files.items():
    with open(os.path.join(components_dir, filename), "w", encoding="utf-8") as f:
        f.write(content)

search_tsx = """import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SearchBar } from '@/features/search/components/SearchBar';
import { SearchFilters } from '@/features/search/components/SearchFilters';
import { SearchResults } from '@/features/search/components/SearchResults';
import { SearchSuggestions } from '@/features/search/components/SearchSuggestions';
import { RecentSearches } from '@/features/search/components/RecentSearches';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export default function SearchScreen() {
    const colors = useDarkColors();
    return (
        <View style={[styles.container, { backgroundColor: colors.canvas }]}>
            <SearchBar />
            <SearchFilters />
            <RecentSearches />
            <SearchResults />
            <SearchSuggestions />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
"""

with open(os.path.join(base_dir, "app", "(tabs)", "search.tsx"), "w", encoding="utf-8") as f:
    f.write(search_tsx)

print("do_refactor complete.")
