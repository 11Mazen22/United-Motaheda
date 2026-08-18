import React from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kit, Text as UIText } from '@pharmacy/ui-native';
import { flexRow, isRtl } from '@/utils/layout';
import { useDarkColors } from '@/hooks/useDarkColors';

export const SearchFilters = React.memo((props: any) => {
    return <View><UIText>SearchFilters</UIText></View>;
});
