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
                    size={40}
                    source={typeof item.img === "string" ? { uri: item.img } : item.img}
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
    paddingTop: 20,
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingBottom: 40,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  imageContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 2,
    top: -40,
  },
  topThreeImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: "white",
  },
  firstImage: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 3,
  },
  podium: {
    alignItems: "center",
    borderRadius: 15,
    padding: 12,
    paddingTop: 35,
  },
  firstPodium: {
    backgroundColor: "#FFE4B5",
    width: 120,
    height: 140,
    zIndex: 1,
    elevation: 4,
  },
  secondPodium: {
    backgroundColor: "#E6E6FA",
    width: 110,
    height: 110,
    marginRight: -5,
    elevation: 3,
  },
  thirdPodium: {
    backgroundColor: "#FFE4E1",
    width: 110,
    height: 110,
    marginLeft: -5,
    elevation: 3,
  },
  crown: {
    position: "absolute",
    top: -75,
    alignSelf: "center",
    zIndex: 3,
  },
  topThreeName: {
    fontSize: 13,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    textAlign: "center",
    marginTop: 5,
    lineHeight: 18,
  },
  firstName: {
    fontSize: 14,
  },
  rank: {
    fontSize: 22,
    fontFamily: "LexendDeca_700Bold",
    marginTop: 5,
  },
  firstRank: {
    fontSize: 28,
    color: "#FFB347",
  },
  secondRank: {
    color: "#9370DB",
  },
  thirdRank: {
    color: "#FF8C69",
  },
  listContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 25,
    flex: 1,
    elevation: 5,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  listRank: {
    width: 25,
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
    marginRight: 10,
  },
  listAvatar: {
    marginRight: 12,
    backgroundColor: "#F5F5F5",
  },
  listName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
});

export default LeaderBoard;
