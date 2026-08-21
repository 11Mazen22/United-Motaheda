import React from "react";

import { View, StyleSheet } from "react-native";

import { Text, Button, useTheme, kit } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";



export interface ErrorStateProps {

  type?: "network" | "notFound" | "generic";

  title?: string;

  message?: string;

  onRetry?: () => void;

  onBack?: () => void;

}



export function ErrorState({

  type = "generic",

  title: overrideTitle,

  message: overrideMessage,

  onRetry,

  onBack,

}: ErrorStateProps) {

  const {} = useTheme();



  let iconName: React.ComponentProps<typeof Ionicons>["name"] = "alert-circle-outline";

  let defaultTitle = "Something went wrong";

  let defaultMessage = "An unexpected error occurred. Please try again.";



  if (type === "network") {

    iconName = "cloud-offline-outline";

    defaultTitle = "Connection Error";

    defaultMessage = "Please check your internet connection and try again.";

  } else if (type === "notFound") {

    iconName = "search-outline";

    defaultTitle = "Not Found";

    defaultMessage = "We couldn't find what you were looking for.";

  }



  const title = overrideTitle || defaultTitle;

  const message = overrideMessage || defaultMessage;



  return (

    <View style={[s.container, { backgroundColor: kit.color.canvas.background }]}>

      <Ionicons name={iconName} size={48} color={kit.color.status.error} />

      <Text variant="h3" align="center" style={{ color: kit.color.text.primary, marginTop: kit.sp(4) }}>

        {title}

      </Text>

      <Text variant="body" align="center" style={{ color: kit.color.text.secondary, marginTop: kit.sp(2) }}>

        {message}

      </Text>

      

      <View style={s.actions}>

        {onRetry && (

          <Button label="Retry" variant="primary" onPress={onRetry} style={s.button} />

        )}

        {onBack && (

          <Button label="Go Back" variant="outline" onPress={onBack} style={s.button} />

        )}

      </View>

    </View>

  );

}



const s = StyleSheet.create({

  container: {

    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: kit.sp(8),

    paddingVertical: kit.sp(12),

  },

  actions: {

    marginTop: kit.sp(6),

    gap: kit.sp(3),

    width: "100%",

    maxWidth: 300,

  },

  button: {

    width: "100%",

  }

});

