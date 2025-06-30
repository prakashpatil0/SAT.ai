import React, { useState, useEffect, FC } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  AppState,
} from "react-native";
import {
  NavigationContainer,
  DrawerActions,
  useNavigation,
  RouteProp,
  ParamListBase,
} from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialIcons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  useFonts,
  LexendDeca_400Regular,
  LexendDeca_500Medium,
  LexendDeca_600SemiBold,
  LexendDeca_700Bold,
} from "@expo-google-fonts/lexend-deca";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";

// Import Screens
import TargetScreen from "@/app/Screens/Telecaller/Tab/TargetScreen";
import HomeScreen from "@/app/Screens/Telecaller/Tab/HomeScreen";
import AttendanceScreen from "@/app/Screens/Telecaller/Tab/AttendanceScreen";
import MainDrawer from "@/app/components/MainDrawer";
import MyScript from "@/app/Screens/Telecaller/DrawerTab/TelecallerMyScript";
import DetailsScreen from "@/app/Screens/Telecaller/TelecallerDetailsScreen";
import ReportScreen from "@/app/Screens/Telecaller/Tab/DailyReportScreen";
import Leaderboard from "@/app/Screens/Telecaller/DrawerTab/TelecallerLeaderBoard";
import TelecallerCallNoteDetails from "@/app/Screens/Telecaller/TelecallerAddCallNoteDetails";
import TelecallerCreateFollowUp from "@/app/Screens/Telecaller/TelecallerCreateFollowUpScreen";
import MyScheduleScreen from "@/app/Screens/Telecaller/DrawerTab/TelecallerMyScheduleScreen";
import ViewFullReport from "@/app/Screens/Telecaller/TelecallerViewFullReport";
import VirtualBusinessCard from "@/app/Screens/Telecaller/DrawerTab/TelecallerVirtualBusinessCard";
import Profile from "@/app/components/MainProfile";
import TelecallerSettings from "@/app/Screens/Telecaller/DrawerTab/TelecallerSettings";
import CameraScreen from "@/app/Screens/Telecaller/TelecallerCameraScreen";
import LoginScreen from "@/app/LoginScreen";
import ContactInfo from "@/app/Screens/Telecaller/TelecallerContactInfo";
import AddContactModal from "@/app/Screens/Telecaller/TelecallerAddContactModal";
import CallHistory from "./Screens/Telecaller/TelecallerCallHistory";
import TelecallerPersonNotes from "@/app/Screens/Telecaller/TelecallerPersonNotes";
import ContactBook from "@/app/components/ContactBook/ContactBook";
import FinancialCalendar from "@/app/components/FinancialCalendar";

import BDMBottomTabs from "@/app/Screens/BDM/BDMBottomTabs";
import BDMContactDetailsScreen from "@/app/Screens/BDM/BDMContactDetailsScreen";
import BDMCompanyDetailsScreen from "@/app/Screens/BDM/BDMCompanyDetailsScreen";
import BDMCallNoteDetailsScreen from "@/app/Screens/BDM/BDMCallNotesScreen";
import BDMReportScreen from "@/app/Screens/BDM/Tab/BDMReportScreen";
import BDMTargetScreen from "@/app/Screens/BDM/Tab/BDMTargetScreen";
import BDMAttendanceScreen from "@/app/Screens/BDM/Tab/BDMAttendanceScreen";
import BDMCreateFollowUp from "@/app/Screens/BDM/BDMCreateFollowUpScreen";
import BDMViewFullReport from "@/app/Screens/BDM/BDMViewFullReport";
import BDMMeetingLogScreen from "@/app/Screens/BDM/Tab/BDMMeetingLogScreen";
import BDMMyNotesScreen from "@/app/Screens/BDM/DrawerTab/BDMMyNotesScreen";
import BDMNotesDetailScreen from "@/app/Screens/BDM/DrawerTab/BDMNotesDetailScreen";
import BDMMyScheduleScreen from "@/app/Screens/BDM/DrawerTab/BDMMyScheduleScreen";
import BDMVirtualBusinessCard from "@/app/Screens/BDM/DrawerTab/BDMVirtualBusinessCard";
import BDMCallHistory from "@/app/Screens/BDM/BDMCallHistory";
import BDMPersonNote from "@/app/Screens/BDM/BDMPersonNote";
import BDMCameraScreen from "@/app/Screens/BDM/BDMCameraScreen";
import PermissionsHandler from "@/app/components/PermissionsHandler";
import BDMCallModal from "@/app/Screens/BDM/BDMCallModal";
import {
  getProfilePhoto,
} from "@/app/utils/profileStorage";
import { ProfileProvider, useProfile } from "@/app/context/ProfileContext";
import SignUpScreen from "@/app/SignUpScreen";
import { testDatabaseConnection } from "@/app/services/api";
import Slide1 from "@/app/Onboarding/Slide1";
import BDMHomeScreen from "@/app/Screens/BDM/Tab/BDMHomeScreen";
import ForgotPassword from '@/app/components/ForgotPassword/ForgotPassword';
import VerifyEmail from '@/app/components/ForgotPassword/VerifyEmail';
import SetNewPassword from '@/app/components/ForgotPassword/SetNewPassword';
import BDMMyCallsScreen from '@/app/Screens/BDM/BDMMyCallsScreen';
import BDMSettings from "@/app/Screens/BDM/BDMSettings";
import BDMMeetingReports from "./Screens/BDM/DrawerTab/BDMMeetingReports";
import { auth } from "@/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BDMContactBook from "@/app/components/ContactBook/BDMContactBook"

import HrHomeScreen from "@/app/HRMS/Tab/HrHomeScreen";
import HrProfile from "./HRMS/DrawerTab/HrProfile";
import ApplyLeaveScreen from "@/app/HRMS/ApplyLeaveScreen";
import CalendarViewScreen from "@/app/HRMS/CalendarViewScreen";
import TelecallerLeaveApplication from "@/app/HRMS/TelecallerLeaveApplication";
import BDMLeaderBoard from "./Screens/BDM/DrawerTab/BDMLeaderBoard";
import HrSettings from "./HRMS/DrawerTab/HrSettings";

import { initializeNotificationService } from "@/app/services/notificationService";

export type RootStackParamList = {
  Login: undefined;
  SignUpScreen: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };
  SetNewPassword: undefined;
  MainApp: undefined;
  BDMStack: undefined;
  BDMHomeScreen: undefined;
  Profile: undefined;
  ContactBook: undefined;
  FinancialCalendar: undefined;
  HrHomeScreen: undefined;
  HrStackNavigator: undefined;
  HrProfile: undefined;
  HrSettings: undefined;
  MeetingDetails: { meetingId: string };
  DealDetails: { dealId: string };
  Meetings: undefined;
  Deals: undefined;
  NewMeeting: undefined;
  NewDeal: undefined;
  Companies: undefined;
  CompanyDetails: { companyId: string };
  NewCompany: undefined;
  Activities: undefined;
  BDMBottomTabs: undefined;
  BDMTarget: undefined;
  BDMAttendance: undefined;
  BDMReport: undefined;
  BDMProfile: undefined;
  MySchedule: undefined;
  BDMCallNoteDetailsScreen: undefined;
  BDMLeaderBoard: undefined;
  BDMCreateFollowUp: undefined;
  BDMViewFullReport: undefined;
  BDMMeetingLog: undefined;
  BDMMyNotesScreen: undefined;
  BDMNotesDetailScreen: undefined;
  BDMVirtualBusinessCard: undefined;
  BDMCallHistory: undefined;
  BDMPersonNote: {
    name: string;
    time: string;
    duration: string;
    type: string;
    notes: string[];
    phoneNumber?: string;
    contactInfo: {
      name: string;
      phoneNumber?: string;
      timestamp: Date;
      duration: string;
    };
    contactIdentifier: string;
  };
  BDMCameraScreen: undefined;
  BDMContactBook: undefined;
  BDMCallModal: undefined;
  BDMContactDetails: {
    contact: {
      name: string;
      phone: string;
      email: string;
    };
  };
  BDMCompanyDetails: {
    company: {
      name: string;
    };
  };
};

type ScreenComponentType<T extends ParamListBase, K extends keyof T> = FC<{
  route: RouteProp<T, K>;
  navigation: any;
}>;

export type BDMStackParamList = {
  BDMHomeScreen: undefined;
  TelecallerLeaveApplication: undefined;
  ApplyLeaveScreen: undefined;
  CalendarViewScreen: undefined;
  Profile: undefined;
  BDMCallHistory: {
    customerName: string;
    meetings: {
      date: string;
      time: string;
      duration: string;
      notes?: string[];
      type: "incoming" | "outgoing" | "missed";
    }[];
    callStats?: {
      totalCalls: number;
      totalDuration: number;
      callTypes: {
        incoming: number;
        outgoing: number;
        missed: number;
        rejected: number;
      };
      dailyCalls: {
        [date: string]: {
          count: number;
          duration: number;
          callTypes: {
            incoming: number;
            outgoing: number;
            missed: number;
            rejected: number;
          };
        };
      };
    };
  };
  BDMCreateFollowUpScreen: {
    contactName?: string;
    phoneNumber?: string;
    notes?: string;
  };
  BDMViewFullReport: undefined;
  BDMBottomTabs: undefined;
  BDMProfile: undefined;
  BDMLeaderBoard: undefined;
  BDMMyNotesScreen: undefined;
  BDMNotesDetailScreen: {
    note: {
      id: string;
      title: string;
      content: string;
      isPinned: boolean;
      createdAt: Date;
      date: string;
      userId: string;
    };
  };
  BDMContactBook: undefined;
  BDMTarget: undefined;
  BDMAttendance: undefined;
  BDMReport: undefined;
  BDMMyScheduleScreen: undefined;
  BDMVirtualBusinessCard: undefined;
  BDMMeetingLogScreen: undefined;
  BDMCameraScreen: {
    type: "in" | "out";
  };
  BDMPersonNote: {
    name: string;
    time: string;
    duration: string;
    type: string;
    notes: string[];
  };
  BDMCallNoteDetailsScreen: {
    meeting: {
      name: string;
      time: string;
      duration: string;
      phoneNumber?: string;
      date?: string;
      type?: "incoming" | "outgoing" | "missed";
      contactType?: "person" | "company";
    };
  };
  BDMContactDetails: {
    contact: {
      name: string;
      phone: string;
      email: string;
    };
  };
  BDMCompanyDetails: {
    company: {
      name: string;
    };
  };
  BDMMyCallsScreen: undefined;
  BDMCreateFollowUp: undefined;
  BDMSettings: undefined;
  BDMMeetingReports: undefined;
};

export type HrStackParamList = {
  HrHomeScreen: undefined;
  TelecallerLeaveApplication: undefined;
  ApplyLeaveScreen: undefined;
  CalendarViewScreen: undefined;
  HrProfile: undefined;
  HrSettings: undefined;
};

SplashScreen.preventAutoHideAsync();

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const CustomHeader = () => {
  const { profilePhotoUri } = useProfile();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <MaterialIcons name="menu" size={30} color="black" />
      </TouchableOpacity>
      <Image
        source={{ uri: profilePhotoUri || "https://via.placeholder.com/150" }}
        style={styles.profileImage}
      />
    </View>
  );
};

const CustomAlertButton = ({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.alertButtonContainer} onPress={onPress}>
    <View style={styles.alertButton}>{children}</View>
  </TouchableOpacity>
);

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <MainDrawer {...props} userRole="telecaller" />}
      screenOptions={{
        drawerActiveTintColor: "#007AFF",
        header: () => null,
      }}
    >
      <Drawer.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen name="Target" component={TargetScreen} />
      <Drawer.Screen name="Attendance" component={AttendanceScreen} />
      <Drawer.Screen name="Report" component={ReportScreen} />
      <Drawer.Screen name="My Script" component={MyScript} />
      <Drawer.Screen name="DetailsScreen" component={DetailsScreen} />
      <Drawer.Screen name="Leaderboard" component={Leaderboard} />
      <Drawer.Screen
        name="CameraScreen"
        component={CameraScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="TelecallerCreateFollowUp"
        component={TelecallerCreateFollowUp}
      />
      <Drawer.Screen name="My Schedule" component={MyScheduleScreen} />
      <Drawer.Screen name="ViewFullReport" component={ViewFullReport} />
      <Drawer.Screen
        name="VirtualBusinessCard"
        component={VirtualBusinessCard}
      />
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="TelecallerSettings" component={TelecallerSettings} />
      <Drawer.Screen name="CallHistory" component={CallHistory} />
      <Drawer.Screen name="ContactInfo" component={ContactInfo} />
      <Drawer.Screen name="AddContactModal" component={AddContactModal} />
      <Drawer.Screen
        name="TelecallerPersonNotes"
        component={TelecallerPersonNotes}
      />
      <Drawer.Screen name="ContactBook" component={ContactBook} />
      <Drawer.Screen name="TelecallerCallNoteDetails" component={TelecallerCallNoteDetails} />
      <Drawer.Screen name="TelecallerLeaveApplication" component={TelecallerLeaveApplication} />
      <Drawer.Screen name="ApplyLeaveScreen" component={ApplyLeaveScreen} />
      <Drawer.Screen name="CalendarViewScreen" component={CalendarViewScreen} />
      <Drawer.Screen name="FinancialCalendar" component={FinancialCalendar} />
    </Drawer.Navigator>
  );
};

const BDMStack = createDrawerNavigator<BDMStackParamList>();

function BDMStackNavigator() {
  return (
    <BDMStack.Navigator
      drawerContent={(props) => <MainDrawer {...props} userRole="bdm" />}
      initialRouteName="BDMHomeScreen"
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: "#fff",
          width: 280,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          elevation: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        drawerLabelStyle: {
          fontFamily: "LexendDeca_400Regular",
          fontSize: 16,
          color: "#333",
          marginLeft: -16,
          paddingLeft: 16,
        },
        drawerItemStyle: {
          paddingVertical: 8,
          marginVertical: 4,
          borderRadius: 8,
        },
        drawerActiveTintColor: "#FF8447",
        drawerInactiveTintColor: "#666",
        drawerActiveBackgroundColor: "#FFF8F0",
        drawerInactiveBackgroundColor: "transparent",
      }}
    >
      <BDMStack.Screen
        name="BDMHomeScreen"
        component={BDMHomeScreen}
        options={{
          title: "Home",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="Profile"
        component={Profile}
        options={{
          title: "Profile",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="BDMContactBook"
        component={BDMContactBook}
        options={{
          title: "Contact Book",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="contacts" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="BDMVirtualBusinessCard"
        component={BDMVirtualBusinessCard}
        options={{
          title: "Virtual Business Card",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="credit-card" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="BDMMyScheduleScreen"
        component={BDMMyScheduleScreen}
        options={{
          title: "My Schedule",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="event" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="BDMMyNotesScreen"
        component={BDMMyNotesScreen}
        options={{
          title: "My Notes",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="edit" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="BDMLeaderBoard"
        component={BDMLeaderBoard}
        options={{
          title: "Leaderboard",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="leaderboard" size={24} color={color} />
          ),
        }}
      />
      <BDMStack.Screen
        name="BDMTarget"
        component={BDMTargetScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMAttendance"
        component={BDMAttendanceScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMReport"
        component={BDMReportScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMContactDetails"
        component={BDMContactDetailsScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMCompanyDetails"
        component={BDMCompanyDetailsScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMCallNoteDetailsScreen"
        component={BDMCallNoteDetailsScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMCallHistory"
        component={BDMCallHistory}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMPersonNote"
        component={BDMPersonNote}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMMeetingLogScreen"
        component={BDMMeetingLogScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMCameraScreen"
        component={BDMCameraScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMNotesDetailScreen"
        component={BDMNotesDetailScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMMyCallsScreen"
        component={BDMMyCallsScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMCreateFollowUp"
        component={BDMCreateFollowUp}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMSettings"
        component={BDMSettings}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMMeetingReports"
        component={BDMMeetingReports}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="BDMViewFullReport"
        component={BDMViewFullReport}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="TelecallerLeaveApplication"
        component={TelecallerLeaveApplication}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="CalendarViewScreen"
        component={CalendarViewScreen}
        options={{ headerShown: false }}
      />
      <BDMStack.Screen
        name="ApplyLeaveScreen"
        component={ApplyLeaveScreen}
        options={{ headerShown: false }}
      />
    </BDMStack.Navigator>
  );
}

const HrStack = createDrawerNavigator<HrStackParamList>();

function HrStackNavigator() {
  return (
    <HrStack.Navigator
      drawerContent={(props) => <MainDrawer {...props} userRole="hr" />}
      initialRouteName="HrHomeScreen"
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: "#fff",
          width: 280,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          elevation: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        drawerLabelStyle: {
          fontFamily: "LexendDeca_400Regular",
          fontSize: 16,
          color: "#333",
          marginLeft: -16,
          paddingLeft: 16,
        },
        drawerItemStyle: {
          paddingVertical: 8,
          marginVertical: 4,
          borderRadius: 8,
        },
        drawerActiveTintColor: "#FF8447",
        drawerInactiveTintColor: "#666",
        drawerActiveBackgroundColor: "#FFF8F0",
        drawerInactiveBackgroundColor: "transparent",
      }}
    >
      <HrStack.Screen
        name="HrHomeScreen"
        component={HrHomeScreen}
        options={{
          title: "Home",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <HrStack.Screen
        name="HrProfile"
        component={HrProfile}
        options={{
          title: "Profile",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
      <HrStack.Screen
        name="HrSettings"
        component={HrSettings}
        options={{
          title: "Settings",
          drawerIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
    </HrStack.Navigator>
  );
}

const RootStack = () => {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");
      setInitialRoute(hasSeenOnboarding ? "Login" : "Slide1");
    } catch (error) {
      setInitialRoute("Slide1");
    }
  };

  if (!initialRoute) {
    return null;
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Slide1" component={Slide1} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUpScreen" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="SetNewPassword" component={SetNewPassword} />
      <Stack.Screen name="MainApp" component={DrawerNavigator} />
      <Stack.Screen
        name="BDMStack"
        component={BDMStackNavigator}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="HrStack"
        component={HrStackNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ContactInfo"
        component={ContactInfo}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    LexendDeca_400Regular,
    LexendDeca_500Medium,
    LexendDeca_600SemiBold,
    Inter_600SemiBold,
    Inter_400Regular,
    LexendDeca_700Bold,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const [appIsReady, setAppIsReady] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    checkExistingSession();
    initializeNotificationService();

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: string) => {
    if (nextAppState === "active") {
      if (auth.currentUser) {
        setIsAuthenticated(true);
        await AsyncStorage.setItem("lastActiveTime", new Date().toISOString());
      } else {
        const sessionToken = await AsyncStorage.getItem("sessionToken");
        const lastActiveTime = await AsyncStorage.getItem("lastActiveTime");

        if (sessionToken && lastActiveTime) {
          const lastActive = new Date(lastActiveTime).getTime();
          const now = new Date().getTime();
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

          if (now - lastActive <= thirtyDaysInMs) {
            setIsAuthenticated(true);
            await AsyncStorage.setItem(
              "lastActiveTime",
              new Date().toISOString()
            );
          } else {
            await AsyncStorage.multiRemove([
              "sessionToken",
              "lastActiveTime",
              "userRole",
            ]);
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      }
    } else if (nextAppState === "background" || nextAppState === "inactive") {
      if (auth.currentUser) {
        await AsyncStorage.setItem("lastActiveTime", new Date().toISOString());
        await AsyncStorage.setItem("sessionToken", auth.currentUser.uid);
      }
    }
  };

  const checkExistingSession = async () => {
    try {
      setIsLoading(true);

      if (auth.currentUser) {
        setIsAuthenticated(true);
        await AsyncStorage.setItem("sessionToken", auth.currentUser.uid);
        await AsyncStorage.setItem("lastActiveTime", new Date().toISOString());
        setIsLoading(false);
        return;
      }

      const [sessionToken, lastActiveTime] = await AsyncStorage.multiGet([
        "sessionToken",
        "lastActiveTime",
      ]);

      if (sessionToken[1] && lastActiveTime[1]) {
        const lastActive = new Date(lastActiveTime[1]).getTime();
        const now = new Date().getTime();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastActive <= thirtyDaysInMs) {
          setIsAuthenticated(true);
          await AsyncStorage.setItem(
            "lastActiveTime",
            new Date().toISOString()
          );
        } else {
          await AsyncStorage.multiRemove([
            "sessionToken",
            "lastActiveTime",
            "userRole",
          ]);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        await AsyncStorage.setItem("sessionToken", user.uid);
        await AsyncStorage.setItem("lastActiveTime", new Date().toISOString());
      } else {
        const sessionToken = await AsyncStorage.getItem("sessionToken");
        const lastActiveTime = await AsyncStorage.getItem("lastActiveTime");

        if (!sessionToken || !lastActiveTime) {
          setIsAuthenticated(false);
        } else {
          const lastActive = new Date(lastActiveTime).getTime();
          const now = new Date().getTime();
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

          if (now - lastActive > thirtyDaysInMs) {
            await AsyncStorage.multiRemove([
              "sessionToken",
              "lastActiveTime",
              "userRole",
            ]);
            setIsAuthenticated(false);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded, fontError]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await testDatabaseConnection();
      } catch (error) {
        Alert.alert("Error", "Failed to test database connection");
      }
    };

    checkConnection();
  }, []);

  if (!appIsReady || (!fontsLoaded && !fontError) || isLoading) {
    return null;
  }

  if (!permissionsGranted) {
    return (
      <PermissionsHandler
        onPermissionsGranted={() => setPermissionsGranted(true)}
      />
    );
  }

  return (
    <ProfileProvider>
      <RootStack />
    </ProfileProvider>
  );
}

const styles = StyleSheet.create({
  alertButtonContainer: {
    top: -25,
    justifyContent: "center",
    alignItems: "center",
  },
  alertButton: {
    width: 60,
    height: 60,
    backgroundColor: "#FF3B30",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 15,
    backgroundColor: "white",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF8447",
  },
});