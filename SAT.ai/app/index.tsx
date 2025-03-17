import React, { useState, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import { NavigationContainer, DrawerActions, useNavigation } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from "@expo/vector-icons";
import * as SplashScreen from 'expo-splash-screen';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { 
  useFonts, 
  LexendDeca_400Regular, 
  LexendDeca_500Medium, 
  LexendDeca_600SemiBold, 
  LexendDeca_700Bold 
} from '@expo-google-fonts/lexend-deca';

import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter"; 
import { Poppins_500Medium, Poppins_600SemiBold } from "@expo-google-fonts/poppins";

// Import Screens
import TargetScreen from "@/app/Screens/Telecaller/Tab/TargetScreen";
import HomeScreen from "@/app/Screens/Telecaller/Tab/HomeScreen";
import AttendanceScreen from "@/app/Screens/Telecaller/Tab/AttendanceScreen";
import CustomDrawerContent from "@/app/components/CustomDrawer";
import AlertScreen from "@/app/Screens/Telecaller/Tab/AlertScreen";
import MyScript from "@/app/Screens/Telecaller/DrawerTab/TelecallerMyScript";
import DetailsScreen from '@/app/Screens/Telecaller/TelecallerDetailsScreen';
import ReportScreen from "@/app/Screens/Telecaller/Tab/DailyReportScreen";
import Leaderboard from "@/app/Screens/Telecaller/DrawerTab/TelecallerLeaderBoard";
import TelecallerCallNoteDetails from "@/app/Screens/Telecaller/TelecallerCallNoteDetails";
import TelecallerCreateFollowUp from "@/app/Screens/Telecaller/TelecallerCreateFollowUpScreen";
import MyScheduleScreen from "@/app/Screens/Telecaller/DrawerTab/TelecallerMyScheduleScreen";
import ViewFullReport from "@/app/Screens/Telecaller/TelecallerViewFullReport";
import VirtualBusinessCard from "@/app/Screens/Telecaller/DrawerTab/TelecallerVirtualBusinessCard";
import Profile from "@/app/Screens/Telecaller/DrawerTab/TelecallerProfile";
import ConfirmationScreen from "@/app/Screens/Telecaller/TelecallerConfirmationScreen";
import CameraScreen from "@/app/Screens/Telecaller/TelecallerCameraScreen";
import LoginScreen from "@/app/LoginScreen";
import ContactInfo from "@/app/Screens/Telecaller/TelecallerContactInfo";
import AddContactModal from "@/app/Screens/Telecaller/TelecallerAddContactModal";
import CallHistory from "./Screens/Telecaller/TelecallerCallHistory";
import TelecallerPersonNotes from "@/app/Screens/Telecaller/TelecallerPersonNotes";
import TelecallerIdleTimer from "@/app/Screens/Telecaller/Tab/TelecallerIdleTimer"
import ContactBook from "@/app/components/ContactBook/ContactBook";

import BDMBottomTabs from "@/app/Screens/BDM/BDMBottomTabs";
import BDMContactDetailsScreen from "@/app/Screens/BDM/BDMContactDetailsScreen";
import BDMCompanyDetailsScreen from "@/app/Screens/BDM/BDMCompanyDetailsScreen";
import BDMDrawer from '@/app/Screens/BDM/BDMDrawer';
import BDMCallNoteDetailsScreen from "@/app/Screens/BDM/BDMCallNotesScreen";
import BDMReportScreen from "@/app/Screens/BDM/BDMReportScreen";
import BDMTargetScreen from "@/app/Screens/BDM/BDMTargetScreen";
import BDMAttendanceScreen from "@/app/Screens/BDM/BDMAttendanceScreen";
import BDMCreateFollowUpScreen from "@/app/Screens/BDM/BDMCreateFollowUpScreen";
import BDMViewFullReport from "@/app/Screens/BDM/BDMViewFullReport";
import BDMMeetingLogScreen from "@/app/Screens/BDM/BDMMeetingLogScreen";
import BDMMyNotesScreen from "@/app/Screens/BDM/BDMMyNotesScreen";
import BDMNotesDetailScreen from "@/app/Screens/BDM/BDMNotesDetailScreen";
import BDMMyScheduleScreen from "@/app/Screens/BDM/BDMMyScheduleScreen";
import BDMVirtualBusinessCard from "@/app/Screens/BDM/BDMVirtualBusinessCard";
import BDMProfile from "@/app/Screens/BDM/BDMProfile";
import BDMLeaderBoard from "@/app/Screens/BDM/BDMLeaderBoard";
import BDMCallHistory from "@/app/Screens/BDM/BDMCallHistory"
import BDMPersonNote from "@/app/Screens/BDM/BDMPersonNote";
import BDMCameraScreen from "@/app/Screens/BDM/BDMCameraScreen";
import PermissionsHandler from '@/app/components/PermissionsHandler';
import BDMCallModal from "@/app/Screens/BDM/BDMCallModal";
import { DEFAULT_PROFILE_IMAGE, getProfilePhoto } from '@/app/utils/profileStorage';
import { ProfileProvider, useProfile } from '@/app/context/ProfileContext';
import SignUpScreen from "@/app/SignUpScreen";
import { testDatabaseConnection } from "@/app/services/api";
import Slide1 from "@/app/Onboarding/Slide1";
import BDMHomeScreen from "@/app/Screens/BDM/BDMHomeScreen";
import { IdleTimerProvider } from '@/context/IdleTimerContext';
import ForgotPassword from '@/app/components/ForgotPassword/ForgotPassword';
import VerifyEmail from '@/app/components/ForgotPassword/VerifyEmail';
import SetNewPassword from '@/app/components/ForgotPassword/SetNewPassword';
import { BackendProvider } from './contexts/BackendContext';






export type RootStackParamList = {
  // Auth Screens
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };
  SetNewPassword: undefined;

  // Main App Screens
  MainApp: undefined;
  BDMHomeScreen: undefined;
  Profile: undefined;
  ContactBook: undefined;

  // BDM Screens
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
};

// Prevent splash screen from hiding automatically
SplashScreen.preventAutoHideAsync();

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const CustomHeader = () => {
  const { profilePhotoUri } = useProfile();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
        <MaterialIcons name="menu" size={30} color="black" />
      </TouchableOpacity>
      <Image
        source={{ uri: profilePhotoUri || DEFAULT_PROFILE_IMAGE }}
        style={styles.profileImage}
      />
    </View>
  );
};

const CustomAlertButton = ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
  <TouchableOpacity style={styles.alertButtonContainer} onPress={onPress}>
    <View style={styles.alertButton}>{children}</View>
  </TouchableOpacity>
);

// const BottomTabNavigator = () => {
//   return (
//     <Tab.Navigator
//       screenOptions={{
//         header: () => null,
//         tabBarActiveTintColor: "#FF8447",
//         tabBarInactiveTintColor: "#8E8E93",
//         tabBarStyle: { backgroundColor: "#F8F8F8", height: 65 },
//         tabBarLabelStyle: { 
//           fontSize: 12,
//           fontFamily: "LexendDeca_400Regular",
//           marginBottom: 8,
//           textAlign: "center",
//           width: 70,
//           flexWrap: "wrap",
//         },
//       }}
//     >
//       <Tab.Screen
//         name="Home"
//         component={HomeScreen}
//         options={{
//           tabBarLabel: "Home",
//           tabBarIcon: ({ color, size }) => <MaterialIcons name="home" color={color} size={size} />,
//         }}
//       />
//       <Tab.Screen
//         name="Target"
//         component={TargetScreen}
//         options={{
//           tabBarLabel: "Target",
//           tabBarIcon: ({ color, size }) => <MaterialIcons name="flag" color={color} size={size} />,
//         }}
//       />
//       <Tab.Screen
//         name="Alert"
//         component={AlertScreenComponent}
//         options={{
//           tabBarLabel: "",
//           tabBarButton: (props) => {
//             const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
//             return (
//               <CustomAlertButton
//                 {...props}
//                 onPress={() => navigation.navigate("AlertScreen")}
//               >
//                 <MaterialIcons name="notifications-active" size={30} color="white" />
//               </CustomAlertButton>
//             );
//           },
//         }}
//       />
//       <Tab.Screen
//         name="Attendance"
//         component={AttendanceScreen}
//         options={{
//           tabBarLabel: "Attendance",
//           tabBarIcon: ({ color, size }) => <MaterialIcons name="event" color={color} size={size} />,
//         }}
//       />
//       <Tab.Screen
//         name="Report"
//         component={ReportScreen}
//         options={{
//           tabBarLabel: "Report",
//           tabBarIcon: ({ color, size }) => <MaterialIcons name="description" color={color} size={size} />,
//         }}
//       />
//     </Tab.Navigator>
//   );
// };

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: "#007AFF",
        header: () => null,
      }}
    >
      {/* <Drawer.Screen name="Main" component={BottomTabNavigator} options={{ headerShown: false }} /> */}
      <Drawer.Screen name="HomeScreen" component={HomeScreen} options={{ headerShown: false }}/>
      <Drawer.Screen name="Target" component={TargetScreen} />
      <Drawer.Screen name="Attendance" component={AttendanceScreen} />
      <Drawer.Screen name="Report" component={ReportScreen} />
      <Drawer.Screen name="AlertScreen" component={AlertScreen} />
      <Drawer.Screen name="My Script" component={MyScript} />
      <Drawer.Screen name="DetailsScreen" component={DetailsScreen} />
      <Drawer.Screen name="Leaderboard" component={Leaderboard} />
      <Drawer.Screen name="CameraScreen" component={CameraScreen} options={{ unmountOnBlur: true }} />
      <Drawer.Screen name="TelecallerCreateFollowUp" component={TelecallerCreateFollowUp} />
      <Drawer.Screen name="My Schedule" component={MyScheduleScreen} />
      <Drawer.Screen name="ViewFullReport" component={ViewFullReport} />
      <Drawer.Screen name="VirtualBusinessCard" component={VirtualBusinessCard} />
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="Confirmation" component={ConfirmationScreen} />
      <Drawer.Screen name="BDMMyNotesScreen" component={BDMMyNotesScreen} />
      <Drawer.Screen name="BDMNotesDetailScreen" component={BDMNotesDetailScreen} />
      <Drawer.Screen name="CallHistory" component={CallHistory} />
      <Drawer.Screen name="ContactInfo" component={ContactInfo} />
      <Drawer.Screen name="AddContactModal" component={AddContactModal} />
      <Drawer.Screen name="TelecallerPersonNotes" component={TelecallerPersonNotes} />
      <Drawer.Screen name="TelecallerIdleTimer" component={TelecallerIdleTimer} />
      <Drawer.Screen name="ContactBook" component={ContactBook} />
      <Drawer.Screen name="TelecallerCallNoteDetails" component={TelecallerCallNoteDetails} />
    </Drawer.Navigator>
  );
};

const BDMStack = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <BDMDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: '80%',
          backgroundColor: 'white',
        },
      }}
      initialRouteName="BDMHomeScreen"
    >
      <Drawer.Screen 
        name="BDMBottomTabs" 
        component={BDMBottomTabs}
        options={{
          title: 'Home'
        }}
      />
      <Drawer.Screen name="BDMHomeScreen" component={BDMHomeScreen} />
      <Drawer.Screen name="BDMTarget" component={BDMTargetScreen} />
      <Drawer.Screen name="BDMAttendance" component={BDMAttendanceScreen} />
      <Drawer.Screen name="BDMReport" component={BDMReportScreen} />
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="MySchedule" component={BDMMyScheduleScreen} options={{headerShown: false}}/>
      <Drawer.Screen name="BDMCallNoteDetailsScreen" component={BDMCallNoteDetailsScreen} />
      <Drawer.Screen name="Leaderboard" component={Leaderboard} />
      <Drawer.Screen name="BDMCreateFollowUp" component={BDMCreateFollowUpScreen} />
      <Drawer.Screen name="BDMViewFullReport" component={BDMViewFullReport} />
      <Drawer.Screen name="BDMMeetingLog" component={BDMMeetingLogScreen} />
      <Drawer.Screen name="BDMMyNotesScreen" component={BDMMyNotesScreen} />
      <Drawer.Screen name="BDMNotesDetailScreen" component={BDMNotesDetailScreen} />
      <Drawer.Screen name="BDMMyScheduleScreen" component={BDMMyScheduleScreen} />
      <Drawer.Screen name="BDMVirtualBusinessCard" component={BDMVirtualBusinessCard} />
      <Drawer.Screen name="BDMProfile" component={BDMProfile} />
      <Drawer.Screen name="BDMLeaderBoard" component={BDMLeaderBoard} />
      <Drawer.Screen name="BDMCallHistory" component={BDMCallHistory} options={{headerShown: false}}/>
      <Drawer.Screen name="BDMPersonNote" component={BDMPersonNote} options={{headerShown: false}}/>
      <Drawer.Screen name="BDMCameraScreen" component={BDMCameraScreen} options={{headerShown: false}}/>
      <Drawer.Screen name="BDMCallModal" component={BDMCallModal}/>
    </Drawer.Navigator>
  );
};

const RootStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Slide1"
      screenOptions={{
        headerShown: false
      }}
    > 
      <Stack.Screen name="Slide1" component={Slide1} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUpScreen" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="SetNewPassword" component={SetNewPassword} />
      <Stack.Screen name="MainApp" component={DrawerNavigator} />
      <Stack.Screen name="BDMHomeScreen" component={BDMStack} />
      <Stack.Screen name="TelecallerIdleTimer" component={TelecallerIdleTimer} options={{ headerShown: false }} />
      <Stack.Screen name="BDMMyNotesScreen" component={BDMMyNotesScreen} />
      <Stack.Screen name="BDMNotesDetailScreen" component={BDMNotesDetailScreen} />

      <Stack.Screen 
        name="BDMContactDetails" 
        component={BDMContactDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMCompanyDetails" 
        component={BDMCompanyDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMCallNoteDetailsScreen" 
        component={BDMCallNoteDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMReportScreen" 
        component={BDMReportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMCreateFollowUpScreen" 
        component={BDMCreateFollowUpScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMViewFullReport" 
        component={BDMViewFullReport}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMMyScheduleScreen" 
        component={BDMMyScheduleScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMVirtualBusinessCard" 
        component={BDMVirtualBusinessCard} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMProfile" 
        component={BDMProfile} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMLeaderBoard" 
        component={BDMLeaderBoard} 
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BDMCallHistory"
        component={BDMCallHistory}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BDMPersonNote" 
        component={BDMPersonNote}
        initialParams={{}} // Add initialParams to fix type error
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BDMCameraScreen"
        component={BDMCameraScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="BDMCallModal" component={BDMCallModal}/>
      <Stack.Screen 
        name="ContactInfo" 
        component={ContactInfo}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      setAppIsReady(true);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await testDatabaseConnection();
        if (!isConnected) {
          Alert.alert('Error', 'Could not connect to database. Please check your internet connection.');
        }
      } catch (error) {
        console.error('Connection test error:', error);
        Alert.alert('Error', 'Failed to test database connection');
      }
    };
    
    checkConnection();
  }, []);

  if (!appIsReady) {
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
      // <BackendProvider>
        <ProfileProvider>
          <IdleTimerProvider>
            <RootStack />
          </IdleTimerProvider>
        </ProfileProvider>
      // </BackendProvider>
  );
}

// Styles
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
    paddingTop: 40, // Increased top padding
    paddingBottom: 15,
    backgroundColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF8447',
  },
});
