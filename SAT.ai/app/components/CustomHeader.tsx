// import React from "react";
// import { View, Text, Image, StyleSheet } from "react-native";
// import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
// import { DrawerContentComponentProps } from "@react-navigation/drawer";

// const CustomDrawerContent = (props: DrawerContentComponentProps) => {
//   return (
//     <View style={{ flex: 1 }}>
//       {/* Profile Section - Transparent Header */}
//       <View style={styles.profileContainer}>
//         <Image
//           source={{ uri: 'https://your-profile-image-url.com' }} // Replace with actual image URL
//           style={styles.profileImage}
//         />
//         <Text style={styles.profileName}>John Doe</Text>
//       </View>

//       {/* Drawer Items */}
//       <DrawerContentScrollView {...props} style={{ backgroundColor: "transparent" }}>
//         <DrawerItemList {...props} />
//       </DrawerContentScrollView>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   profileContainer: {
//     alignItems: "center",
//     paddingVertical: 10,
//     backgroundColor: "transparent", 
//   },
//   profileImage: {
//     width: 60,
//     height: 60,
//     borderRadius: 30,
//     borderWidth: 2,
//     borderColor: "#F4C57A",
//   },
//   profileName: {
//     fontSize: 16,
//     fontWeight: "bold",
//     marginTop: 8,
//     color: "#000",
//   },
// });

// export default CustomDrawerContent;

const CustomHeader = () => {
  // ... existing component code ...
};

export default CustomHeader;
