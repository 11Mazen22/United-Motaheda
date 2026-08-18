import React from 'react';
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
