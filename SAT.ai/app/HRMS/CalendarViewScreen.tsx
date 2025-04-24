import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Dimensions,
  Modal,
} from "react-native";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import { useNavigation } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import { IconButton } from "react-native-paper";
import { format } from "date-fns";
import { auth, db, storage } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore"; // Importing necessary Firestore functions

const { width } = Dimensions.get("window");

const CalendarViewScreen: React.FC = () => {
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [selectedTimeFrame, setSelectedTimeFrame] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const flatListRef = useRef(null);

  const navigation = useNavigation();

  const leaveTypeOptions = [
    { label: "Leaves", value: "leaves" },
    { label: "Holidays", value: "holidays" },
  ];

  const timeFrameOptions = [
    { label: "This Quarter", value: "this_quarter" },
    { label: "This Year", value: "this_year" },
    { label: "Past Year", value: "past_year" },
  ];
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [eventDates, setEventDates] = useState<{ [key: string]: string }>({});

  const daysInMonth = (month: number, year: number): number =>
    new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number): number =>
    new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const days = daysInMonth(month, year);
    const firstDay = firstDayOfMonth(month, year);

    const dates = [];

    // Fill initial blanks
    for (let i = 0; i < firstDay; i++) {
      dates.push(<View key={`empty-${i}`} style={styles.dateCell} />);
    }

    for (let i = 1; i <= days; i++) {
      const dateKey = format(new Date(year, month, i), "yyyy-MM-dd");
      const event = eventDates[dateKey];

      const circleStyle =
        event?.type === "holiday"
          ? { backgroundColor: "#C7E6FF" }
          : event?.type === "leave"
          ? { backgroundColor: "#E3D7F9" }
          : null;

      dates.push(
        <TouchableOpacity
          key={`date-${i}`}
          style={styles.dateCell}
          onPress={() => event && handleDatePress(dateKey)}
        >
          <View style={[styles.circleWrapper, circleStyle]}>
            <Text style={styles.dateText}>{i}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return dates;
  };

  const [upcomingLeaves, setUpcomingLeaves] = useState([]);
  const [approvedLeaveDates, setApprovedLeaveDates] = useState<string[]>([]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, "leave_applications"),
      where("userId", "==", userId),
      where("status", "==", "approved")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const datesMap: {
        [key: string]: { name: string; type: "leave" | "holiday" };
      } = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const from = data.fromDate?.toDate?.();
        const to = data.toDate?.toDate?.();
        const leaveType = data.leaveType;

        const isHoliday =
          leaveType?.toLowerCase()?.includes("holiday") ||
          leaveType?.toLowerCase()?.includes("public");

        if (from && to && leaveType) {
          const current = new Date(from);
          while (current <= to) {
            const formatted = format(current, "yyyy-MM-dd");
            datesMap[formatted] = {
              name: leaveType,
              type: isHoliday ? "holiday" : "leave",
            };
            current.setDate(current.getDate() + 1);
          }
        }
      });

      setEventDates(datesMap);
      setApprovedLeaveDates(Object.keys(datesMap));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const today = new Date();
    let startDate = today;
    let endDate = null; // open-ended unless filtered

    // Only apply filtering if a timeframe is selected
    if (selectedTimeFrame === "this_quarter") {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      startDate = new Date(currentYear, quarterStartMonth, 1);
      endDate = new Date(currentYear, quarterStartMonth + 3, 0);
    } else if (selectedTimeFrame === "this_year") {
      const year = today.getFullYear();
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else if (selectedTimeFrame === "past_year") {
      const year = today.getFullYear() - 1;
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }

    const isLeaveSelected = selectedLeaveType === "leaves";

    // Build query dynamically
    let baseQuery = query(
      collection(db, "leave_applications"),
      where("userId", "==", userId),
      where("status", "==", "approved"),
      where("fromDate", ">=", startDate)
    );

    // Only apply "endDate" condition if selectedTimeFrame is not empty
    if (selectedTimeFrame !== "" && endDate) {
      baseQuery = query(baseQuery, where("fromDate", "<=", endDate));
    }

    const unsubscribe = onSnapshot(baseQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const item = doc.data();
        return {
          id: doc.id,
          leaveType: item.leaveType,
          fromDate: item.fromDate?.toDate?.(),
          toDate: item.toDate?.toDate?.(),
        };
      });

      setUpcomingLeaves(isLeaveSelected ? data : []);
    });

    return () => unsubscribe();
  }, [selectedLeaveType, selectedTimeFrame]);

  const leaveAssets = {
    "Sick Leave": {
      image: require("@/assets/images/sick.png"),
      bgColor: "#FFD9E0",
    },
    "Emergency Leave": {
      image: require("@/assets/images/emergency.png"),
      bgColor: "#FFD9E0",
    },
    "Casual Leave": {
      image: require("@/assets/images/casual.png"),
      bgColor: "#D9F8FF",
    },
    "Maternity Leave": {
      image: require("@/assets/images/maternity.png"),
      bgColor: "#D9F8FF",
    },
  };

  const handleDatePress = (dateKey: string) => {
    setSelectedEvent({ date: dateKey, event: eventDates[dateKey]?.name });
    setModalVisible(true);
  };

  const changeMonth = (direction: any) => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(
      selectedMonth.getMonth() + (direction === "next" ? 1 : -1)
    );
    setSelectedMonth(newMonth);
  };

  return (
    <AppGradient>
      <TelecallerMainLayout
        showDrawer
        showBackButton={true}
        showBottomTabs={true}
        title={"Calendar View"}
      >
        <ScrollView style={styles.container}>
          {/* Top Button Row */}
          <View style={styles.header}>
            <View style={styles.iconRow}>
              <TouchableOpacity
                style={styles.inActiveIcon}
                onPress={() =>
                  navigation.navigate("TelecallerLeaveApplication")
                }
              >
                <MaterialCommunityIcons
                  name="view-dashboard-outline"
                  size={25}
                  color="black"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.activeIcon}
                onPress={() => navigation.navigate("CalendarViewScreen")}
              >
                <MaterialCommunityIcons
                  name="calendar-month"
                  size={25}
                  color="black"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => navigation.navigate("ApplyLeaveScreen")} // Replace with your screen name
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                Apply for a Leave
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ position: "relative" }}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <IconButton
                  icon="chevron-left"
                  size={30}
                  onPress={() => changeMonth("prev")}
                />
                <Text style={styles.monthTitle}>
                  {selectedMonth.toLocaleString("default", { month: "long" })}{" "}
                  {selectedMonth.getFullYear()}
                </Text>
                <IconButton
                  icon="chevron-right"
                  size={30}
                  onPress={() => changeMonth("next")}
                />
              </View>

              <View style={styles.calendar}>
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
                  (day) => (
                    <Text key={day} style={styles.dayHeader}>
                      {day}
                    </Text>
                  )
                )}
                {renderCalendar()}
              </View>
            </View>

            {modalVisible && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={24}
                      color="black"
                    />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {format(new Date(selectedEvent?.date || ""), "dd MMM yyyy")}
                  </Text>
                  <Text style={styles.modalDescription}>
                    {selectedEvent?.event}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#C7E6FF" }]}
              />
              <Text>Public Holiday</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#E3D7F9" }]}
              />
              <Text>Planned Leave</Text>
            </View>
          </View>

          <View style={styles.Box}>
            <Text style={styles.sectionTitle}>Upcoming Leaves & Holidays</Text>

            <View style={styles.filterBox}>
              <View style={styles.dropdownContainer}>
                <Dropdown
                  style={styles.dropdown}
                  data={leaveTypeOptions}
                  labelField="label"
                  valueField="value"
                  placeholder="Leave Type"
                  value={selectedLeaveType}
                  onChange={(item) => {
                    setSelectedLeaveType(item.value);
                  }}
                />
              </View>

              <View style={styles.dropdownContainer}>
                <Dropdown
                  style={styles.dropdown}
                  data={timeFrameOptions}
                  labelField="label"
                  valueField="value"
                  placeholder="Time Frame"
                  value={selectedTimeFrame}
                  onChange={(item) => {
                    setSelectedTimeFrame(item.value);
                  }}
                />
              </View>
            </View>

            {upcomingLeaves.length > 0 ? (
              upcomingLeaves.map((leave) => {
                const { image, bgColor } = leaveAssets[leave.leaveType] || {};

                return (
                  <View key={leave.id} style={styles.leaveItem}>
                    <View
                      style={[
                        styles.iconImageBg,
                        { backgroundColor: bgColor || "#eee" },
                      ]}
                    >
                      <Image source={image} style={styles.iconImage} />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.leaveType}>{leave.leaveType}</Text>
                      <Text style={styles.leaveDate}>
                        {format(leave.fromDate, "dd MMM yyyy")} -{" "}
                        {format(leave.toDate, "dd MMM yyyy")}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.noData}>
                <Image
                  source={require("@/assets/images/pastimage.png")}
                  style={styles.noDataImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        </ScrollView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginBottom: 50,
  },
  Box: {
    padding: 10,
    backgroundColor: "white",
    marginTop: 20,
    borderWidth: 1, // Add this
    borderColor: "#ddd", // Light grey border color
    borderRadius: 10,
    marginBottom: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  iconRow: {
    flexDirection: "row",
    gap: 20,
  },
  activeIcon: {
    backgroundColor: "#d1ffe7", // Light Green Background
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 15, // Slightly rounded like your image
    borderWidth: 1,
    borderColor: "#34c759", // Green Border
  },

  inActiveIcon: {
    backgroundColor: "white", // White Background
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 15, // Slightly rounded like your image
    borderWidth: 1,
    borderColor: "#ddd", // Light Grey Border
  },

  applyBtn: {
    backgroundColor: "#FF8447",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  leaveCountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1, // Add this
    borderColor: "#ddd", // Light grey border color
  },
  earnedTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },

  filterBtn: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    marginTop: 5,
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center", // Add this line
  },

  noData: {
    alignItems: "center",
  },
  noDataImage: {
    width: width * 0.7, // 80% of screen width
    height: width * 0.7, // maintain aspect ratio
  },
  dropdown: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },

  filterBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    gap: 10, // space between 2 dropdowns
  },

  dropdownContainer: {
    flex: 1, // Both dropdown will take equal space
  },
  leaveBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  card: {
    width: (Dimensions.get("window").width * 0.9) / 2,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    elevation: 2,
    alignItems: "center",
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginVertical: 5,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    gap: 5,
  },
  activeDot: {
    width: 8,
    height: 8,
    backgroundColor: "#34c759",
    borderRadius: 50,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    backgroundColor: "#ccc",
    borderRadius: 50,
  },
  prevBtn: {
    position: "absolute",
    left: 10,
    top: "40%",
    backgroundColor: "#FFEDE4",
    borderRadius: 50,
    padding: 5,
  },
  nextBtn: {
    position: "absolute",
    right: 0,
    top: "40%",
    backgroundColor: "#FFEDE4",
    borderRadius: 50,
    padding: 5,
  },
  cardImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },

  imageBg: {
    borderRadius: 50,
    padding: 15,
    marginVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  iconImage: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  leaveItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },

  iconImageBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  leaveType: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
  },

  leaveDate: {
    fontSize: 13,
    color: "#666",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginVertical: 2,
  },
  leftText: {
    fontSize: 14,
    color: "#333",
  },
  rightText: {
    fontSize: 14,
    color: "#333",
  },
  line: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    marginVertical: 5,
    width: "100%",
  },
  calendarContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderWidth: 1,
    backgroundColor: "#F5F1FD",
    borderColor: "#DCDCDC",
    borderRadius: 15,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_700Bold",
    color: "#000",
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayHeader: {
    width: "14.28%",
    textAlign: "center",
    fontFamily: "LexendDeca_600SemiBold",
    color: "#7B827E",
    fontSize: 12,
    marginBottom: 10,
  },
  dateCell: {
    width: "14.28%",
    alignItems: "center",
    marginBottom: 10,
  },
  dateText: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
  },

  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    gap: 20,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "white",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 20, height: 20, borderRadius: 15 },
  highlightedDate: { backgroundColor: "#E3D7F9", borderRadius: 50 },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // semi-transparent overlay
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderRadius: 10,
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "60%",
    alignItems: "center",
    elevation: 5,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 16,
  },
  circleWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CalendarViewScreen;
