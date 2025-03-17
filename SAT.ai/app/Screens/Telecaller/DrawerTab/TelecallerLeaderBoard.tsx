import React from "react";
import { View, Text, Image, StyleSheet, ScrollView } from "react-native";
import { Avatar } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import { FontAwesome5 } from "@expo/vector-icons";
// Correctly define local images with `require()`
const topThree = [
  { rank: 2, name: "Shivani\nMore", img: require("@/assets/images/shivani.png") },
  { rank: 1, name: "Samiksha\nShetty", img: require("@/assets/images/sami.png") },
  { rank: 3, name: "Arya\nTarawde", img: require("@/assets/images/Arya.png") },
];

// Correctly mix local and remote images
const leaderboardData = [
  { rank: 4, name: "Aarushi Pandey", img: require("@/assets/images/girl.png") }, // Local image
  { rank: 5, name: "Divya Jagtap", img: require("@/assets/images/girl.png") },
  { rank: 6, name: "Sakshi Chaturi",  img: require("@/assets/images/girl.png") }, // Remote image
  { rank: 7, name: "Ananya Patil", img: require("@/assets/images/girl.png") },
  { rank: 8, name: "Gargi Deshmukh",  img: require("@/assets/images/girl.png") },
  { rank: 9, name: "Deepika Deshmukh", img: require("@/assets/images/girl.png") },
  { rank: 10, name: "Aarya Patil", img: require("@/assets/images/girl.png") },
];

const LeaderBoard = () => {
  return (
    <AppGradient>
      <ScrollView style={styles.container}>
        <TelecallerMainLayout showDrawer showBottomTabs showBackButton title="Leaderboard">
          <View style={styles.content}>
            {/* Top Three Section */}
            <View style={styles.topThreeContainer}>
              {/* Second Place */}
              <View style={styles.secondPlaceContainer}>
                <View style={styles.imageContainer}>
                  <Image source={topThree[0].img} style={styles.topThreeImage} />
                </View>
                <View style={[styles.podium, styles.secondPodium]}>
                  <Text style={styles.topThreeName}>{topThree[0].name}</Text>
                  <Text style={[styles.rank, styles.secondRank]}>2</Text>
                </View>
              </View>

              {/* First Place (Centered and Highlighted) */}
              <View style={styles.firstPlaceContainer}>
              <FontAwesome5 name="crown" size={40} color="#FFD700" style={styles.crown} />
  
                <View style={styles.imageContainer}>
                  <Image source={topThree[1].img} style={[styles.topThreeImage, styles.firstImage]} />
                </View>
                <View style={[styles.podium, styles.firstPodium]}>
                  <Text style={[styles.topThreeName, styles.firstName]}>{topThree[1].name}</Text>
                  <Text style={[styles.rank, styles.firstRank]}>1</Text>
                </View>
              </View>

              {/* Third Place */}
              <View style={styles.thirdPlaceContainer}>
                <View style={styles.imageContainer}>
                  <Image source={topThree[2].img} style={styles.topThreeImage} />
                </View>
                <View style={[styles.podium, styles.thirdPodium]}>
                  <Text style={styles.topThreeName}>{topThree[2].name}</Text>
                  <Text style={[styles.rank, styles.thirdRank]}>3</Text>
                </View>
              </View>
            </View>

            {/* List Section */}
            <View style={styles.listContainer}>
              {leaderboardData.map((item) => (
                <View key={item.rank} style={styles.listItem}>
                  <Text style={styles.listRank}>{item.rank}</Text>
                  <Avatar.Image
                    size={45}
                    source={typeof item.img === "string" ? { uri: item.img } : item.img} // Correctly handle local & remote images
                    style={styles.listAvatar}
                  />
                  <Text style={styles.listName}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </TelecallerMainLayout>
      </ScrollView>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingBottom: 30,
    marginBottom: 20,
  },
  imageContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 2,
    top: -35,
  },
  topThreeImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "white",
  },
  firstImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  podium: {
    alignItems: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    paddingTop: 40,
  },
  firstPodium: {
    backgroundColor: "#FFC107",
    width: 130,
    height: 160,
    zIndex: 1,
  },
  secondPodium: {
    backgroundColor: "#D1C4E9",
    width: 130,
    height: 120,
    marginRight: -10,
  },
  thirdPodium: {
    backgroundColor: "#FFCCBC",
    width: 130,
    height: 120,
    marginLeft: -10,
  },
  crown: {
    position: "absolute",
    top: -70,
    alignSelf: "center",
    zIndex: 3,
  },
  topThreeName: {
    fontSize: 14,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    textAlign: "center",
    marginTop: 5,
  },
  firstName: {
    fontSize: 16,
  },
  rank: {
    fontSize: 24,
    fontFamily: "LexendDeca_700Bold",
    marginTop: 8,
  },
  firstRank: {
    fontSize: 32,
    color: "#FFF",
  },
  secondRank: {
    color: "#5C6BC0",
  },
  thirdRank: {
    color: "#FF7043",
  },
  listContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingTop: 30,
    flex: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  listRank: {
    width: 30,
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#666",
  },
  listAvatar: {
    marginRight: 15,
    backgroundColor: "#F5F5F5",
  },
  listName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
});

export default LeaderBoard;
