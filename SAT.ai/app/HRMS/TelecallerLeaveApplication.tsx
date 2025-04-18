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

import { auth, db, storage } from "@/firebaseConfig";
import { collection, getDocs, query, where,onSnapshot} from "firebase/firestore"; // Importing necessary Firestore functions

const { width } = Dimensions.get("window");

const TelecallerLeaveApplication: React.FC = () => {
  const [earnedLeaveData, setEarnedLeaveData] = useState([]);
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
  const leaveTypes = [
    {
      id: "1",
      title: "Sick Leave",
      granted: 25,
      taken: 12,
      available: 13,
      image: require("@/assets/images/sick.png"),
    },
    {
      id: "2",
      title: "Emergency Leave",
      granted: 25,
      taken: 15,
      available: 10,
      image: require("@/assets/images/emergency.png"),
    },
    {
      id: "3",
      title: "Casual Leave",
      granted: 20,
      taken: 5,
      available: 15,
      image: require("@/assets/images/casual.png"),
    },
    {
      id: "4",
      title: "Maternity Leave",
      granted: 90,
      taken: 30,
      available: 60,
      image: require("@/assets/images/maternity.png"),
    },
  ];
  const renderLeaveCard = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>

      <View
        style={[
          styles.imageBg,
          {
            backgroundColor:
              item.title === "Sick Leave" || item.title === "Emergency Leave"
                ? "#FFD9E0"
                : "#D9F8FF",
          },
        ]}
      >
        <Image source={item.image} style={styles.cardImage} />
      </View>

      {/* Row for Granted */}
      <View style={styles.row}>
        <Text style={styles.leftText}>Granted</Text>
        <Text style={styles.rightText}>{item.granted}</Text>
      </View>

      {/* Row for Taken */}
      <View style={styles.row}>
        <Text style={styles.leftText}>Taken</Text>
        <Text style={styles.rightText}>{item.taken}</Text>
      </View>

      {/* Horizontal Line */}
      <View style={styles.line} />

      {/* Row for Available */}
      <View style={styles.row}>
        <Text style={styles.leftText}>Available</Text>
        <Text style={styles.rightText}>{item.available}</Text>
      </View>
    </View>
  );

  const handleNext = () => {
    if (currentIndex < leaveTypes.length - 2) {
      const newIndex = currentIndex + 2;
      flatListRef.current?.scrollToIndex({ index: newIndex });
      setCurrentIndex(newIndex);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 2 < 0 ? 0 : currentIndex - 2;
      flatListRef.current?.scrollToIndex({ index: newIndex });
      setCurrentIndex(newIndex);
    }
  };
   // Fetching Earned Leave data in real-time
   useEffect(() => {
    const q = query(
      collection(db, "leave_applications"), // Replace 'leaveRequests' with your actual Firestore collection name
      where("leaveType", "==", "Earned Leave")
    );

    // Using onSnapshot() to listen to real-time updates
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map((doc) => doc.data());
      setEarnedLeaveData(data); // Set the fetched earned leave data to the state
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, []);

  return (
    <AppGradient>
      <TelecallerMainLayout
        showDrawer
        showBackButton={true}
        showBottomTabs={true}
        title={"Leave Application"}
      >
        <ScrollView style={styles.container}>
          {/* Top Button Row */}
          <View style={styles.header}>
            <View style={styles.iconRow}>
              <TouchableOpacity
                style={styles.activeIcon}
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
                style={styles.inActiveIcon}
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

           {/* Earned Leave Section */}
           <View style={styles.leaveCountBox}>
            <Text style={styles.earnedTitle}>Earned Leave</Text>
            <Text>{earnedLeaveData.length > 0 ? `${earnedLeaveData.length} days` : "No data found"}</Text>
          </View>

          <View style={styles.leaveBox}>
            <FlatList
              ref={flatListRef}
              data={leaveTypes}
              renderItem={renderLeaveCard}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / ((width * 0.9) / 2)
                );
                setCurrentIndex(index);
              }}
              contentContainerStyle={{ paddingVertical: 10 }}
            />

            {/* Prev Arrow (only show if not at the first slide) */}
{currentIndex !== 0 && (
  <TouchableOpacity style={styles.prevBtn} onPress={handlePrev}>
    <Ionicons name="chevron-back" size={20} color="black" />
  </TouchableOpacity>
)}

{/* Next Arrow (only show if not at the last slide) */}
{currentIndex < leaveTypes.length - 2 && (
  <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
    <Ionicons name="chevron-forward" size={20} color="black" />
  </TouchableOpacity>
)}

          </View>

          <View style={styles.dotRow}>
            {Array.from({ length: Math.ceil(leaveTypes.length / 2) }).map(
              (_, index) => (
                <View
                  key={index}
                  style={
                    Math.floor(currentIndex / 2) === index
                      ? styles.activeDot
                      : styles.inactiveDot
                  }
                />
              )
            )}
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
          {/* Past Leave */}
          <View style={styles.Box}>
            <Text style={styles.sectionTitle}>Past Leaves & Holidays</Text>

            <View style={styles.noData}>
              <Image
                source={require("@/assets/images/pastimage.png")}
                style={styles.noDataImage}
              />

              <Text>No Result Found</Text>
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
});

export default TelecallerLeaveApplication;
