import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { useNavigation, RouteProp, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { MaterialIcons } from "@expo/vector-icons";
import { Camera } from "expo-camera";
import AppGradient from "@/app/components/AppGradient";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/firebaseConfig";
import { format } from "date-fns";
import { doc, getDoc } from "firebase/firestore";
import * as Location from "expo-location";

type AttendanceStatus = "Present" | "Half Day" | "On Leave";

type CameraScreenParams = {
  photo: { uri: string };
  location: { coords: { latitude: number; longitude: number } };
  dateTime: Date;
  isPunchIn: boolean;
};

const getUserRole = async (): Promise<string | null> => {
  const userId = auth.currentUser?.uid;
  if (!userId) return null;

  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists() ? userDoc.data().role : null;
};

type RootStackParamList = {
  CameraScreen: { isPunchIn: boolean };
  AttendanceScreen: {
    photo?: { uri: string };
    location?: { coords: { latitude: number; longitude: number } };
    isPunchIn?: boolean;
    locationName?: string | null;
  };
};

type AttendanceScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface AttendanceRecord {
  date: string;
  day: string;
  punchIn: string;
  punchOut: string;
  status: AttendanceStatus;
  userId: string;
  timestamp: Date;
}

interface WeekDay {
  day: string;
  date: string;
  status: AttendanceStatus;
}

const EIGHT_HOURS_IN_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const FOUR_HOURS_IN_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const PUNCH_IN_DEADLINE = "09:45"; // 9:45 AM for full day
const PUNCH_IN_HALF_DAY = "14:00"; // 2:00 PM for half day
const PUNCH_OUT_MINIMUM = "18:30"; // 6:30 PM
const NEXT_DAY_PUNCH_TIME = "08:45"; // 8:45 AM

const { width } = Dimensions.get("window");

const AttendanceScreen = () => {
  const navigation = useNavigation<AttendanceScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "AttendanceScreen">>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "MMMM")
  );
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(
    null
  );
  const [filteredHistory, setFilteredHistory] = useState<AttendanceRecord[]>([]);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const [punchInTime, setPunchInTime] = useState("");
  const [punchOutTime, setPunchOutTime] = useState("");
  const [isPunchedIn, setIsPunchedIn] = useState<boolean>(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [statusCounts, setStatusCounts] = useState({
    Present: 0,
    "Half Day": 0,
    "On Leave": 0,
  });
  const [isPunchButtonDisabled, setIsPunchButtonDisabled] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);
  const [waveAnimation] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(true);

  const [weekDays, setWeekDays] = useState<WeekDay[]>([
    { day: "M", date: "", status: "On Leave" },
    { day: "T", date: "", status: "On Leave" },
    { day: "W", date: "", status: "On Leave" },
    { day: "T", date: "", status: "On Leave" },
    { day: "F", date: "", status: "On Leave" },
    { day: "S", date: "", status: "On Leave" },
  ]);

  const statusColors: Record<AttendanceStatus, string> = {
    Present: "#4CAF50",
    "Half Day": "#FF9800",
    "On Leave": "#F44336",
  };

  const checkPunchAvailability = () => {
    const now = new Date();
    const currentTime = format(now, "HH:mm");
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);
    const today = format(now, "dd");
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 30, 0, 0); // Set to 8:30 AM next day

    if (punchOutTime) {
      setIsPunchButtonDisabled(now < tomorrow);
      return;
    }

    if (!punchInTime) {
      const punchInDeadline = "18:15"; // 2 PM
      const [deadlineHour, deadlineMinute] = punchInDeadline
        .split(":")
        .map(Number);

      const currentMinutes = currentHour * 60 + currentMinute;
      const deadlineMinutes = deadlineHour * 60 + deadlineMinute;

      setIsPunchButtonDisabled(currentMinutes > deadlineMinutes);
    } else if (punchInTime && !punchOutTime) {
      const punchOutEnableTime = "09:15"; // 6:15 PM
      const [enableHour, enableMinute] = punchOutEnableTime
        .split(":")
        .map(Number);
      const enableMinutes = enableHour * 60 + enableMinute;
      const currentMinutes = currentHour * 60 + currentMinute;

      setIsPunchButtonDisabled(currentMinutes < enableMinutes);
    }
  };

  useEffect(() => {
    checkPunchAvailability();
    const interval = setInterval(checkPunchAvailability, 60000);
    return () => clearInterval(interval);
  }, [punchInTime, punchOutTime]);

  const calculateStatus = (
    punchIn: string,
    punchOut: string
  ): AttendanceStatus => {
    // No punch-in: On Leave
    if (!punchIn) return "On Leave";

    // Punch-in exists, no punch-out: Present
    if (punchIn && !punchOut) return "Present";

    // Both punch-in and punch-out exist: Check duration
    const [punchInHours, punchInMinutes] = punchIn.split(":").map(Number);
    const [punchOutHours, punchOutMinutes] = punchOut.split(":").map(Number);

    // Convert to minutes for calculation
    const punchInTotalMinutes = punchInHours * 60 + punchInMinutes;
    let punchOutTotalMinutes = punchOutHours * 60 + punchOutMinutes;

    // Handle case where punch-out is on the next day
    if (punchOutTotalMinutes < punchInTotalMinutes) {
      punchOutTotalMinutes += 24 * 60; // Add 24 hours
    }

    // Calculate duration in hours
    const durationMinutes = punchOutTotalMinutes - punchInTotalMinutes;
    const durationHours = durationMinutes / 60;

    // Status logic: < 4 hours = On Leave, 4-8 hours = Half Day, >= 8 hours = Present
    if (durationHours < 4) {
      return "On Leave";
    } else if (durationHours >= 4 && durationHours < 8) {
      return "Half Day";
    } else {
      return "Present";
    }
  };

  const handlePunchInOut = async (isPunchIn: boolean) => {
    try {
      if (isPunchButtonDisabled) {
        if (!punchInTime) {
          Alert.alert(
            "Punch In Not Allowed",
            "You can only punch in before 2:00 PM."
          );
        } else {
          Alert.alert(
            "Punch Out Not Allowed",
            "You can punch out after 2:15 PM today or punch in again tomorrow at 8:45 AM."
          );
        }
        return;
      }

      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status === "granted") {
        navigation.navigate("CameraScreen", { isPunchIn });
      } else {
        Alert.alert(
          "Permission Required",
          "Camera permission is required to take attendance photos."
        );
      }
    } catch (err) {
      console.log("Error:", err);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const role = await getUserRole();
      if (!role) return;

      const attendanceRef = collection(db, `${role}_monthly_attendance`);
      const querySnapshot = await getDocs(attendanceRef);

      const history: AttendanceRecord[] = [];
      const today = format(new Date(), "dd");

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const status = calculateStatus(data.punchIn, data.punchOut);

        history.push({
          date: data.date,
          day: data.day,
          punchIn: data.punchIn || "",
          punchOut: data.punchOut || "",
          status,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
        });

        if (data.date === today && data.userId === userId) {
          setPunchInTime(
            data.punchIn
              ? format(new Date(`2000-01-01T${data.punchIn}`), "hh:mm a")
              : ""
          );
          setPunchOutTime(
            data.punchOut
              ? format(new Date(`2000-01-01T${data.punchOut}`), "hh:mm a")
              : ""
          );
          setIsPunchedIn(!!data.punchIn && !data.punchOut);
        }
      });

      setIsNewUser(history.length === 0);

      const sortedHistory = history
        .filter((record) => record.userId === userId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAttendanceHistory(sortedHistory);
      calculateStatusCounts(sortedHistory);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    }
  };

  const calculateStatusCounts = (history: AttendanceRecord[]) => {
    const currentMonth = format(new Date(), "MM");
    const currentYear = format(new Date(), "yyyy");

    const counts = {
      Present: 0,
      "Half Day": 0,
      "On Leave": 0,
    };

    if (history.length === 0) {
      setStatusCounts(counts);
      return;
    }

    const daysInMonth = new Date(
      parseInt(currentYear),
      parseInt(currentMonth),
      0
    ).getDate();

    const allDates = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(
        parseInt(currentYear),
        parseInt(currentMonth) - 1,
        i + 1
      );
      return {
        dateStr: format(date, "dd"),
        isSunday: format(date, "EEEE") === "Sunday",
      };
    });

    const currentMonthRecords = history.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return (
        format(recordDate, "MM") === currentMonth &&
        format(recordDate, "yyyy") === currentYear
      );
    });

    currentMonthRecords.forEach((record) => {
      counts[record.status]++;
    });

    const today = format(new Date(), "dd");

    const attendedDates = currentMonthRecords.map((record) => record.date);
    const onLeaveDates = allDates.filter(
      ({ dateStr, isSunday }) =>
        !isSunday &&
        !attendedDates.includes(dateStr) &&
        parseInt(dateStr) < parseInt(today)
    );

    counts["On Leave"] += onLeaveDates.length;

    setStatusCounts(counts);
  };

  const saveAttendance = async (
    isPunchIn: boolean,
    photoUri: string,
    location: any,
    locationNameFromCamera?: string | null
  ) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const role = await getUserRole();
      if (!role) {
        Alert.alert("Error", "User role not found");
        return;
      }

      const currentTime = new Date();
      const dateStr = format(currentTime, "dd");
      const dayStr = format(currentTime, "EEE").toUpperCase();
      const timeStr = format(currentTime, "HH:mm");
      const roleCollection = `${role}_monthly_attendance`;
      const locationName = locationNameFromCamera || "Unknown Location";
      const attendanceRef = collection(db, roleCollection);

      const todayQuery = query(
        attendanceRef,
        where("date", "==", dateStr),
        where("userId", "==", userId)
      );

      const querySnapshot = await getDocs(todayQuery);

      if (querySnapshot.empty) {
        // New attendance record
        const status = isPunchIn ? "Present" : "On Leave";

        // Fetch user data from Firestore
        const userDocSnap = await getDoc(doc(db, "users", userId));
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};

        await addDoc(attendanceRef, {
          userId,
          employeeName: userData.name || "",
          email: userData.email || "",
          date: dateStr,
          day: dayStr,
          punchIn: isPunchIn ? timeStr : "",
          punchOut: !isPunchIn ? timeStr : "",
          status,
          timestamp: Timestamp.fromDate(currentTime),
          photoUri,
          location,
        });
      } else {
        // Update existing record
        const docRef = querySnapshot.docs[0].ref;
        const existingData = querySnapshot.docs[0].data();

        const newPunchIn = isPunchIn ? timeStr : existingData.punchIn;
        const newPunchOut = !isPunchIn ? timeStr : existingData.punchOut;
        const newStatus = calculateStatus(newPunchIn, newPunchOut);

        await updateDoc(docRef, {
          punchIn: newPunchIn,
          punchOut: newPunchOut,
          status: newStatus,
          location: !isPunchIn ? location : existingData.location,
          photoUri: !isPunchIn ? photoUri : existingData.photoUri,
          totalHours: isPunchIn
            ? existingData.totalHours
            : existingData.totalHours + EIGHT_HOURS_IN_MS,
        });
      }

      // Update UI
      if (isPunchIn) {
        setPunchInTime(format(currentTime, "hh:mm a"));
        setIsPunchedIn(true);
      } else {
        setPunchOutTime(format(currentTime, "hh:mm a"));
        setIsPunchedIn(false);
      }

      fetchAttendanceHistory(); // Refresh data
    } catch (error) {
      console.error("Error saving attendance:", error);
      Alert.alert("Error", "Failed to save attendance");
    }
  };

  useEffect(() => {
    if (
      route.params?.photo &&
      route.params?.location &&
      route.params?.isPunchIn !== undefined
    ) {
      const { photo, location, locationName, isPunchIn } = route.params;
      saveAttendance(isPunchIn, photo.uri, location, locationName);
    }
  }, [route.params]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  useEffect(() => {
    if (attendanceHistory.length > 0) {
      updateWeekDays();
    }
  }, [attendanceHistory]);

  useEffect(() => {
    if (attendanceHistory.length > 0) {
      let filtered = [...attendanceHistory];

      filtered = filtered.filter((record) => {
        const recordDate = new Date(record.timestamp);
        return format(recordDate, "MMMM") === selectedMonth;
      });

      if (selectedStatus) {
        filtered = filtered.filter(
          (record) => record.status === selectedStatus
        );
      }

      setFilteredHistory(filtered);
      calculateStatusCounts(filtered);
    }
  }, [selectedMonth, selectedStatus, attendanceHistory]);

  const updateWeekDays = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const updatedWeekDays = weekDays.map((dayObj, index) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);

      const dateStr = format(currentDate, "dd");

      const attendanceRecord = attendanceHistory.find(
        (record) => record.date === dateStr
      );

      if (currentDate > today) {
        return {
          day: dayObj.day,
          date: dateStr,
          status: "On Leave" as AttendanceStatus,
        };
      } else {
        return {
          day: dayObj.day,
          date: dateStr,
          status: attendanceRecord
            ? attendanceRecord.status
            : ("On Leave" as AttendanceStatus),
        };
      }
    });

    setWeekDays(updatedWeekDays);
  };

  const renderStatusBadge = (status: AttendanceStatus) => {
    const isSelected = selectedStatus === status;
    return (
      <TouchableOpacity
        onPress={() => setSelectedStatus(isSelected ? null : status)}
        style={[
          styles.statusBadge,
          { borderColor: statusColors[status] },
          isSelected && { backgroundColor: statusColors[status] },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            { color: statusColors[status] },
            isSelected && { color: "#FFFFFF" },
          ]}
        >
          {status}
        </Text>
        {!isNewUser && (
          <Text style={[styles.daysText, isSelected && { color: "#FFFFFF" }]}>
            {statusCounts[status]} days
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimation, {
            toValue: 1,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnimation.setValue(0);
    }
  }, [isLoading]);

  const renderWaveSkeleton = () => {
    const translateX = waveAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width],
    });

    return (
      <View style={styles.skeletonContainer}>
        <View style={styles.skeletonPunchCard}>
          <View style={styles.skeletonPunchHeader}>
            <View style={styles.skeletonPunchTitle} />
            <View style={styles.skeletonPunchButton} />
          </View>
          <View style={styles.skeletonPunchTimes}>
            <View style={styles.skeletonPunchTimeBlock}>
              <View style={styles.skeletonPunchLabel} />
              <View style={styles.skeletonPunchTime} />
            </View>
            <View style={styles.skeletonPunchTimeBlock}>
              <View style={styles.skeletonPunchLabel} />
              <View style={styles.skeletonPunchTime} />
            </View>
          </View>
        </View>

        <View style={styles.skeletonCalendarCard}>
          <View style={styles.skeletonDateHeader} />
          <View style={styles.skeletonWeekDays}>
            {[1, 2, 3, 4, 5, 6].map((_, index) => (
              <View key={index} style={styles.skeletonDayContainer}>
                <View style={styles.skeletonDayCircle} />
                <View style={styles.skeletonWeekName} />
                <View style={styles.skeletonDateNumber} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.skeletonMonthSelector}>
          {[1, 2, 3, 4, 5].map((_, index) => (
            <View key={index} style={styles.skeletonMonthButton} />
          ))}
        </View>

        <View style={styles.skeletonStatusContainer}>
          {[1, 2, 3].map((_, index) => (
            <View key={index} style={styles.skeletonStatusBadge} />
          ))}
        </View>

        <Animated.View
          style={[styles.waveOverlay, { transform: [{ translateX }] }]}
        />
      </View>
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <AppGradient>
        <TelecallerMainLayout
          showDrawer
          showBackButton={true}
          title="Attendance"
        >
          {renderWaveSkeleton()}
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} title="Attendance">
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.punchCard}>
              <View style={styles.punchHeader}>
                <Text style={styles.punchTitle}>Take Attendance</Text>
                {!punchInTime ? (
                  <TouchableOpacity
                    style={[
                      styles.punchButton,
                      styles.punchInButton,
                      isPunchButtonDisabled && styles.disabledButton,
                    ]}
                    onPress={() => handlePunchInOut(true)}
                    disabled={isPunchButtonDisabled}
                  >
                    <Text
                      style={[
                        styles.punchInText,
                        isPunchButtonDisabled && styles.disabledButtonText,
                      ]}
                    >
                      Punch In
                    </Text>
                  </TouchableOpacity>
                ) : isPunchedIn && !punchOutTime ? (
                  <TouchableOpacity
                    style={[
                      styles.punchButton,
                      styles.punchOutButton,
                      isPunchButtonDisabled && styles.disabledButton,
                    ]}
                    onPress={() => handlePunchInOut(false)}
                    disabled={isPunchButtonDisabled}
                  >
                    <Text
                      style={[
                        styles.punchOutText,
                        isPunchButtonDisabled && styles.disabledButtonText,
                      ]}
                    >
                      Punch Out
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.punchTimes}>
                <View style={styles.punchTimeBlock}>
                  <Text style={styles.punchLabel}>Punch In</Text>
                  <Text style={styles.punchTime}>{punchInTime || "——"}</Text>
                </View>
                <View style={styles.punchTimeBlock}>
                  <Text style={styles.punchLabel}>Punch Out</Text>
                  <Text style={styles.punchTime}>{punchOutTime || "——"}</Text>
                </View>
              </View>
            </View>

            {!isNewUser && (
              <View style={styles.calendarCard}>
                <Text style={styles.dateHeader}>
                  {format(currentDate, "dd MMMM (EEEE)")}
                </Text>

                <View style={styles.weekDays}>
                  {weekDays.map((item, index) => (
                    <View key={index} style={styles.dayContainer}>
                      <View
                        style={[
                          styles.dayCircle,
                          {
                            backgroundColor:
                              item.status === "Present"
                                ? "#4CAF50"
                                : item.status === "Half Day"
                                ? "#FF9800"
                                : item.status === "On Leave"
                                ? "#F44336"
                                : "white",
                          },
                        ]}
                      >
                        {item.status === "Present" && (
                          <MaterialIcons name="check" size={20} color="#FFF" />
                        )}
                        {item.status === "Half Day" && (
                          <MaterialIcons name="remove" size={20} color="#FFF" />
                        )}
                        {item.status === "On Leave" && (
                          <MaterialIcons name="close" size={20} color="#FFF" />
                        )}
                      </View>
                      <Text style={styles.weekName}>{item.day}</Text>
                      <Text style={styles.dateNumber}>{item.date}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!isNewUser && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.monthSelector}
              >
                {months.map((month, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedMonth(month)}
                    style={[
                      styles.monthButton,
                      selectedMonth === month && styles.selectedMonthButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthText,
                        selectedMonth === month && styles.selectedMonthText,
                      ]}
                    >
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View
              style={[
                styles.statusContainer,
                isNewUser && styles.newUserStatusContainer,
              ]}
            >
              {renderStatusBadge("Present")}
              {renderStatusBadge("Half Day")}
              {renderStatusBadge("On Leave")}
            </View>

            {!isNewUser && (
              <View style={styles.historyContainer}>
                {filteredHistory.map((item, index) => (
                  <View key={index} style={styles.historyCard}>
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateNumber}>{item.date}</Text>
                      <Text style={styles.dateDay}>{item.day}</Text>
                    </View>
                    <View style={styles.timeBlock}>
                      <View>
                        <Text style={styles.timeLabel}>Punch In</Text>
                        <Text style={styles.timeValue}>
                          {item.punchIn || "——"}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.timeLabel}>Punch Out</Text>
                        <Text style={styles.timeValue}>
                          {item.punchOut || "——"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBlock,
                        { backgroundColor: getStatusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                ))}
                {filteredHistory.length === 0 && (
                  <Text style={styles.noHistoryText}>
                    No attendance records found for {selectedMonth}
                    {selectedStatus ? ` with status ${selectedStatus}` : ""}
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Present":
      return "#E8F5E9";
    case "Half Day":
      return "#FFF3E0";
    case "On Leave":
      return "#FFEBEE";
    default:
      return "#E8F5E9";
  }
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  punchCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  punchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  punchTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
  },
  punchButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  punchInButton: {
    borderColor: "#4CAF50",
    backgroundColor: "#4CAF50",
  },
  punchOutButton: {
    borderColor: "#FF6B00",
    backgroundColor: "transparent",
  },
  punchInText: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#FFFFFF",
  },
  punchOutText: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#FF6B00",
  },
  punchTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  punchTimeBlock: {
    flex: 1,
  },
  punchLabel: {
    fontSize: 14,
    color: "#666",
    fontFamily: "LexendDeca_400Regular",
    marginBottom: 4,
  },
  punchTime: {
    fontSize: 16,
    color: "#333",
    fontFamily: "LexendDeca_500Medium",
  },
  calendarCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: "100%",
  },
  dateHeader: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  dayContainer: {
    alignItems: "center",
    width: 45,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  weekName: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
    fontFamily: "LexendDeca_500Medium",
  },
  dateNumber: {
    fontSize: 12,
    color: "#666",
    fontFamily: "LexendDeca_400Regular",
    marginTop: 2,
  },
  monthSelector: {
    flexDirection: "row",
    marginBottom: 16,
  },
  monthButton: {
    marginRight: 24,
  },
  monthText: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
  },
  selectedMonthText: {
    color: "#FF8447",
    textDecorationLine: "underline",
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    marginBottom: 24,
    gap: 10,
    alignItems: "center",
    marginRight: 15,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 100,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    marginBottom: 4,
  },
  daysText: {
    fontSize: 12,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
  },
  historyContainer: {
    flex: 1,
  },
  historyCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBlock: {
    width: 50,
    alignItems: "center",
  },
  dateDay: {
    fontSize: 12,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
  },
  timeBlock: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  timeLabel: {
    fontSize: 12,
    color: "#666",
    fontFamily: "LexendDeca_400Regular",
  },
  timeValue: {
    fontSize: 14,
    color: "#333",
    fontFamily: "LexendDeca_500Medium",
  },
  statusBlock: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: "#CCCCCC",
    borderColor: "#CCCCCC",
  },
  disabledButtonText: {
    color: "#666666",
  },
  selectedMonthButton: {
    borderBottomWidth: 2,
    borderBottomColor: "#FF8447",
  },
  noHistoryText: {
    textAlign: "center",
    color: "#666",
    fontFamily: "LexendDeca_400Regular",
    fontSize: 14,
    marginTop: 20,
  },
  newUserStatusContainer: {
    marginTop: 32,
    marginBottom: 32,
    justifyContent: "center",
    gap: 20,
  },
  skeletonContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  skeletonPunchCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonPunchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  skeletonPunchTitle: {
    width: 120,
    height: 24,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
  },
  skeletonPunchButton: {
    width: 100,
    height: 40,
    backgroundColor: "#e0e0e0",
    borderRadius: 6,
  },
  skeletonPunchTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonPunchTimeBlock: {
    flex: 1,
  },
  skeletonPunchLabel: {
    width: 80,
    height: 16,
    backgroundColor: "#e0e0e0",
    marginBottom: 8,
    borderRadius: 4,
  },
  skeletonPunchTime: {
    width: 100,
    height: 20,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
  },
  skeletonCalendarCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonDateHeader: {
    width: 200,
    height: 24,
    backgroundColor: "#e0e0e0",
    marginBottom: 16,
    borderRadius: 4,
  },
  skeletonWeekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  skeletonDayContainer: {
    alignItems: "center",
    width: 45,
  },
  skeletonDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },
  skeletonWeekName: {
    width: 20,
    height: 16,
    backgroundColor: "#e0e0e0",
    marginTop: 4,
    borderRadius: 4,
  },
  skeletonDateNumber: {
    width: 16,
    height: 16,
    backgroundColor: "#e0e0e0",
    marginTop: 2,
    borderRadius: 4,
  },
  skeletonMonthSelector: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  skeletonMonthButton: {
    width: 80,
    height: 24,
    backgroundColor: "#e0e0e0",
    marginRight: 24,
    borderRadius: 4,
  },
  skeletonStatusContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 16,
    marginBottom: 24,
  },
  skeletonStatusBadge: {
    width: 100,
    height: 40,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
  waveOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    transform: [{ translateX: 0 }],
  },
});

export default AttendanceScreen;