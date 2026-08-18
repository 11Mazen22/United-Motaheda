import React from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { flexRow, isRtl, textAlignStart } from '@/utils/layout';
import { useDarkColors } from '@/hooks/useDarkColors';

export const SearchSuggestions = React.memo((props: any) => {
    return <View><UIText>SearchSuggestions</UIText></View>;
});
