import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from "react-native-vector-icons/MaterialCommunityIcons";


const BDMLeaderBoard = () => {
  const scaleAnim = new Animated.Value(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 20,
      friction: 7,
      useNativeDriver: true
    }).start();
  }, []);

  const topThree = [
    { rank: 2, name: "Shivani Thombre", image: require('@/assets/images/girlprofile.png') },
    { rank: 1, name: "Samiksha Shetty", image: require('@/assets/images/girlprofile.png') },
    { rank: 3, name: "Arya Tarawde", image: require('@/assets/images/girlprofile.png') },
  ];

  const leaderboardData = [
    { rank: 4, name: "Aarushi Pandey", image: require('@/assets/images/girlprofile.png') },
    { rank: 5, name: "Divya Jagtap", image: require('@/assets/images/profile.png') },
    { rank: 6, name: "Sakshi Chaturi", image: require('@/assets/images/girlprofile.png') },
    { rank: 7, name: "Ananya Patil", image: require('@/assets/images/girlprofile.png') },
    { rank: 8, name: "Gargi Deshmukh", image: require('@/assets/images/girlprofile.png') },
    { rank: 9, name: "Deepika Deshmukh", image: require('@/assets/images/girlprofile.png') },
    { rank: 10, name: "Aarya Patil", image: require('@/assets/images/profile.png') },
  ];

  const renderTopThree = () => {
    // Fade-in animation for leaderboard items
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);
    return (
      <View style={styles.podiumContainer}>
        {/* Second Place */}
        <View style={[styles.podiumBlock, styles.secondPlace]}>
          <Image source={topThree[0].image} style={styles.avatar} />
          <Text style={styles.podiumName}>{topThree[0].name}</Text>
          <View style={[styles.rankBox, { backgroundColor: '#D1C4E9' }]}>
            <Text style={styles.rankText}>2</Text>
          </View>
        </View>

        {/* First Place */}
        <View style={[styles.podiumBlock, styles.firstPlace]}>
          <Icon name="crown" size={24} color="#FFD700" style={styles.crownIcon} />
          <Image source={topThree[1].image} style={styles.avatar} />
          <Text style={styles.podiumName}>{topThree[1].name}</Text>
          <View style={[styles.rankBox, { backgroundColor: '#FFC107' }]}>
            <Text style={styles.rankText}>1</Text>
          </View>
        </View>

        {/* Third Place */}
        <View style={[styles.podiumBlock, styles.thirdPlace]}>
          <Image source={topThree[2].image} style={styles.avatar} />
          <Text style={styles.podiumName}>{topThree[2].name}</Text>
          <View style={[styles.rankBox, { backgroundColor: '#FFCCBC' }]}>
            <Text style={styles.rankText}>3</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#f0f4f8', '#fcf1e8']} style={styles.container}>
      <BDMScreenHeader title="Leaderboard" />
      <View style={styles.mainContent}>
        {/* Podium Section */}
        <View style={styles.podiumContainer}>
          {renderTopThree()}
        </View>
        <Text style={styles.leaderboardTitle}>Top 10 BDMs</Text>
        <ScrollView style={styles.leaderboardList}>
          {leaderboardData.map((item) => (
            <View key={item.rank} style={styles.leaderboardItem}>
              <View style={styles.rankCircle}>
                <Text style={styles.rankNumber}>{item.rank}</Text>
              </View>
              <Image source={item.image} style={styles.listAvatar} />
              <Text style={styles.listName}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

export default BDMLeaderBoard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 5,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 5,
    paddingHorizontal: 10,
  },
  podiumBlock: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    margin: 5,
  },
  firstPlace: {
    backgroundColor: '#FFC107',
    height: 140,
    width: 110,
    zIndex: 2,
  },
  secondPlace: {
    backgroundColor: '#D1C4E9',
    height: 120,
    width: 100,
    marginTop: 20,
  },
  thirdPlace: {
    backgroundColor: '#FFCCBC',
    height: 120,
    width: 100,
    marginTop: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'white',
  },
  crownIcon: {
    position: 'absolute',
    top: -15,
    alignSelf: 'center',
  },
  podiumName: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  rankBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  rankText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaderboardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    top: 30,
  },
  leaderboardList: {
    flex: 1,
    marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 10,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rankCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  listName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});

