import React, { useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Share, Animated, Alert } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';

const VirtualBusinessCard = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewShotRef = useRef<ViewShot>(null); 
  const navigation = useNavigation();
  // Animate Card Entry
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Share Business Card
  const handleShare = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current?.capture();
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } catch (error) {
      console.error('Error sharing the business card:', error);
    }
  };
  // Download Business Card
  const handleDownload = async () => {
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        const fileUri = `${FileSystem.documentDirectory}business_card.png`;

        //save captured image to file system
        await FileSystem.moveAsync({
          from: uri,
          to: fileUri,
        });

        //Request perimission to save image
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(fileUri);
          Alert.alert('Download Successful', 'Your business card has been saved to your gallery.');
        } else {
          Alert.alert('Permission Denied', 'Allow access to save images.');
        }
      }
    } catch (error) {
      console.error('Error downloading the business card:', error);
      Alert.alert('Download Failed', 'Something went wrong while saving the image.');
    }
  }
  return (
    
    <LinearGradient colors={["#f0f4f8", "#fcf1e8"]} style={styles.container}>
        <BDMScreenHeader title="Virtual Business Card" />
      {/* Capture Card for Sharing */}
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          {/* Card Top with Wavy Background */}
          <View style={styles.cardTop}>
            <Svg width={300} height={120} viewBox="0 0 300 100" style={styles.wavyBackground}>
              <Path fill="#FCE8DC" d="M0,0 C100,100 200,-50 300,0 L300,100 L0,100 Z" />
            </Svg>
            <Image source={require("@/assets/images/policy_planner_logo.png")} style={styles.logo} />
          </View>

          {/* Business Card Details */}
          <Text style={styles.name}>
            SAMIKSHA <Text style={styles.highlight}>SHETTY</Text>
          </Text>
          <Text style={styles.designation}>Tele caller</Text>

          {/* Contact Details */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color="#ff7b42" />
              <Text style={styles.infoText}>7798612243</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="email" size={20} color="#ff7b42" />
              <Text style={styles.infoText}>samiksha@gmail.com</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="language" size={20} color="#ff7b42" />
              <Text style={[styles.infoText, styles.website]} onPress={() => Linking.openURL("https://www.policyplanner.com")}>
                www.policyplanner.com
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={20} color="#ff7b42" />
              <Text style={styles.infoText}>
                Office No. B-03, KPCT Mall, Near Vishal Mega Mart, Fatima Nagar, Wanawadi, Pune 411013.
              </Text>
            </View>
          </View>
          <View style={styles.bottomLine} />
        </Animated.View>
      </ViewShot>

      {/* Share & Download Buttons */}
        <Animatable.View animation="pulse" iterationCount="infinite" duration={1500}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Feather name="share-2" size={24} color="#333" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
          <Feather name="download" size={24} color="#333" />
          <Text style={styles.actionText}>Download</Text>
        </TouchableOpacity>
      </View>
      </Animatable.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    // alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: '#262626',
    textAlign: "center",
    position: "absolute",
    marginLeft: 80,
    
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    padding: 0,
    width: 300,
    height: 430,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    // left: 8,
    marginLeft: 30,
    justifyContent: "center",
    top: 10,
  },
  cardTop: {
    alignItems: "flex-start",
    marginBottom: 20,
  },
  wavyBackground: {
    position: "absolute",
    alignSelf: "flex-start",
    top: -10,
    left: 0,
    width: '100%',
    height: '100%',
    transform: [{ rotate: '180deg' }],
  },
  logo: {
    width: 120,
    height: 100,
    resizeMode: 'contain',
    alignSelf: "flex-start",
    marginLeft: 20,
  },       
  name: {
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "left",
    color: '#004a77',
    marginLeft: 20,
    top: 50,
  },
  highlight: {
    color: '#EC691F',
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    top: 40,
    
  },
  designation: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: 'left',
    color: '#161616',
    marginBottom: 10,
    marginLeft: 20,
  },
  infoContainer: {
    marginTop: 30,
    marginLeft: 20,
    marginRight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: '#333',
    marginLeft: 8,
  },
  website: {
    color: '#007aff',
    textDecorationLine: 'underline',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 15,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: '#5F6368',
    marginTop: 5,
  },
  bottomLine: {
    height: 10,
    backgroundColor: '#EC691F', 
    width: 300,
    marginTop: 25, 
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    alignSelf: "center",
  },
  
});
export default VirtualBusinessCard;
