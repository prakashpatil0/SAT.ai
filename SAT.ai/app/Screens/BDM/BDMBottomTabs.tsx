import React from "react";
import { View, TouchableOpacity, StyleSheet, GestureResponderEvent } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import BDMHomeScreen from "@/app/Screens/BDM/BDMHomeScreen";
import BDMTargetScreen from "@/app/Screens/BDM/BDMTargetScreen";
import BDMAttendanceScreen from "@/app/Screens/BDM/BDMAttendanceScreen";
import BDMReportScreen from "@/app/Screens/BDM/BDMReportScreen";
import BDMMeetingLogScreen from "@/app/Screens/BDM/BDMMeetingLogScreen";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

const Tab = createBottomTabNavigator();

type CustomButtonProps = {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
}

const CustomMeetingButton = ({ children, onPress }: CustomButtonProps) => (
  <TouchableOpacity 
    style={styles.meetingButtonContainer} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.meetingButton}>{children}</View>
  </TouchableOpacity>
);

const TabIcon = ({ 
  name, 
  color, 
  size, 
  focused 
}: {
  name: string;
  color: string;
  size: number;
  focused: boolean;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.2 : 1) }]
  }));

  return (
    <Animated.View style={animatedStyle}>
      <MaterialIcons 
        name={name as keyof typeof MaterialIcons.glyphMap} 
        color={color} 
        size={size} 
      />
    </Animated.View>
  );
};

const BDMBottomTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF8447",
        tabBarInactiveTintColor: "#808080",
        tabBarStyle: {
          height: 70,
          backgroundColor: "#fff",
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "LexendDeca_400Regular",
          marginBottom: 8,
        },
      }}
    >
      <Tab.Screen
        name="BDMHomeScreen"
        component={BDMHomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: (props) => <TabIcon {...props} name="home" />,
        }}
      />
      <Tab.Screen
        name="BDMTargetScreen"
        component={BDMTargetScreen}
        options={{
          tabBarLabel: "Target",
          tabBarIcon: (props) => <TabIcon {...props} name="flag" />,
        }}
      />
      <Tab.Screen
        name="BDMMeetingLogScreen"
        component={BDMMeetingLogScreen}
        options={{
          tabBarLabel: "",
          tabBarButton: (props) => (
            <CustomMeetingButton 
              onPress={() => props.onPress && props.onPress()}
            >
              <MaterialIcons name="assignment" size={25} color="white" />
            </CustomMeetingButton>
          ),
        }}
      />
      <Tab.Screen
        name="BDMAttendanceScreen"
        component={BDMAttendanceScreen}
        options={{
          tabBarLabel: "Attendance",
          tabBarIcon: (props) => <TabIcon {...props} name="event" />,
        }}
      />
      <Tab.Screen
        name="BDMReportScreen"
        component={BDMReportScreen}
        options={{
          tabBarLabel: "Report",
          tabBarIcon: (props) => <TabIcon {...props} name="description" />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  meetingButtonContainer: {
    top: -20,
    justifyContent: "center",
    alignItems: "center",
  },
  meetingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF8447",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF8447",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});

export default BDMBottomTabs;