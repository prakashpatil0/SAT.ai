import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useProfile } from "@/app/context/ProfileContext";

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { userProfile } = useProfile();

  const defaultImage = require("@/assets/images/girlprofile.png");
  
  return (
    <View style={{ flex: 1 }}>
      {/* Profile Section - Transparent Header */}
      <View style={styles.profileContainer}>
        <Image
          source={
            userProfile?.profileImageUrl 
              ? { uri: userProfile.profileImageUrl } 
              : defaultImage
          }
          style={styles.profileImage}
        />
        <Text style={styles.profileName}>
          {userProfile?.name || "User Name"}
        </Text>
        <Text style={styles.designation}>
          {userProfile?.designation || "Designation"}
        </Text>
      </View>

      {/* Drawer Items */}
      <DrawerContentScrollView {...props} style={{ backgroundColor: "transparent" }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  profileContainer: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(244, 197, 122, 0.2)",
    marginBottom: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#F4C57A",
  },
  profileName: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    marginTop: 10,
    color: "#293646",
  },
  designation: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    marginTop: 4,
  },
});

export default CustomDrawerContent;
