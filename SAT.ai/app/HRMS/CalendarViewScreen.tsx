import React, { useState, useRef } from "react";
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

const { width } = Dimensions.get("window");

const CalendarViewScreen: React.FC = () => {
  const [selectedLeaveType, setSelectedLeaveType] = useState("leaves");
  const [selectedTimeFrame, setSelectedTimeFrame] = useState("this_quarter");
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

  const eventDates = {
    3: "Holi Dolyatra",
    6: "Holi",
  };

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
    for (let i = 0; i < firstDay; i++) {
      dates.push(<View key={`empty-${i}`} style={styles.dateCell} />);
    }

    for (let i = 1; i <= days; i++) {
      const hasEvent = eventDates[i];

      dates.push(
        <TouchableOpacity
          key={`date-${i}`}
          style={[styles.dateCell, hasEvent && styles.highlightedDate]}
          onPress={() => hasEvent && handleDatePress(i)}
        >
          <Text style={styles.dateText}>{i}</Text>
        </TouchableOpacity>
      );
    }

    return dates;
  };

  const handleDatePress = (day: any) => {
    setSelectedEvent({ day, event: eventDates[day] });
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
                    March {selectedEvent?.day}
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
            {/* Upcoming Leaves */}
            <Text style={styles.sectionTitle}>Upcoming Leaves & Holidays</Text>

            <View style={styles.filterBox}>
              <View style={styles.dropdownContainer}>
                <Dropdown
                  style={styles.dropdown}
                  data={leaveTypeOptions}
                  labelField="label"
                  valueField="value"
                  placeholder="Select Leave Type"
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
                  placeholder="Select Time Frame"
                  value={selectedTimeFrame}
                  onChange={(item) => {
                    setSelectedTimeFrame(item.value);
                  }}
                />
              </View>
            </View>

            <View style={styles.leaveItem}>
              <View
                style={[
                  styles.iconImageBg,
                  { backgroundColor: "#D9F8FF" }, // Casual Leave BG
                ]}
              >
                <Image
                  source={require("@/assets/images/casual.png")}
                  style={styles.iconImage}
                />
              </View>

              <View style={{ marginLeft: 10 }}>
                <Text style={styles.leaveType}>Casual Leave</Text>
                <Text style={styles.leaveDate}>
                  10 April 2025 - 12 April 2025
                </Text>
              </View>
            </View>

            <View style={styles.leaveItem}>
              <View
                style={[
                  styles.iconImageBg,
                  { backgroundColor: "#FFD9E0" }, // Emergency Leave BG
                ]}
              >
                <Image
                  source={require("@/assets/images/emergency.png")}
                  style={styles.iconImage}
                />
              </View>

              <View style={{ marginLeft: 10 }}>
                <Text style={styles.leaveType}>Emergency Leave</Text>
                <Text style={styles.leaveDate}>
                  10 April 2025 - 12 April 2025
                </Text>
              </View>
            </View>
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
    marginTop: 20,
  },
  noDataImage: {
    width: 300,
    height: 300,
    marginBottom: 10,
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
});

export default CalendarViewScreen;
