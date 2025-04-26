import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Platform, Linking, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { RootStackParamList } from '../navigation/types';


export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  // Add other screen names and their params as needed
};
const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: "Welcome To SAT.ai",
    description: "SAT.ai is designed to streamline sales tracking, improve productivity, and provide real-time insights for telecallers and BDMs.",
    imageUrl: "assets/Slide1.png",
  },
  {
    id: 2,
    title: "Set & Track Targets",
    description: "Ensure your team stays on track with clear weekly targets and real-time performance monitoring. Keep motivation high and goals within reach.",
    imageUrl: "assets/Slide2.png",
  },
  {
    id: 3,
    title: "Easy Call Logging",
    description: "For telecallers - Log calls effortlessly, track duration, categorize leads (Prospect, Suspect, Closing), and schedule follow-ups to maximize conversions.",
    imageUrl: "assets/Slide3.png",
  },
  {
    id: 4,
    title: "Smart Meeting Logs",
    description: "For BDMs - Add meeting details, track deal closures, and provide managers with visibility into field activities and sales performance.",
    imageUrl: "assets/Screen4.png",
  },
  {
    id: 5,
    title: "Get Started",
    description: "Boost productivity and drive results with SAT.ai, start tracking and achieving your sales goals now!",
    imageUrl: "assets/Screen5.png",
  }
];

const OnboardingScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideImages, setSlideImages] = useState<{ [key: number]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const swiperRef = useRef<Swiper | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const openDocument = async (documentType: 'terms' | 'privacy') => {
    try {
      setIsLoading(true);
      const documentRef = ref(storage, `documents/${documentType === 'terms' ? 'Terms_and_Conditions.pdf' : 'privacy_policy.pdf'}`);
      const url = await getDownloadURL(documentRef);
      
      // Open the document URL in the device's default PDF viewer
      await Linking.openURL(url);
    } catch (error) {
      console.error(`Error opening ${documentType} document:`, error);
      Alert.alert(
        'Error',
        `Could not open ${documentType === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'} document. Please try again later.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Preload and cache images
  const preloadImages = useCallback(async () => {
    const imageUrls: { [key: number]: string } = {};
    const cacheDir = `${FileSystem.cacheDirectory}onboarding_images/`;
    
    // Create cache directory if it doesn't exist
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });

    for (const slide of slides) {
      try {
        const imageRef = ref(storage, slide.imageUrl);
        const url = await getDownloadURL(imageRef);
        
        // Check if image is already cached
        const cachedPath = `${cacheDir}${slide.id}.jpg`;
        const fileInfo = await FileSystem.getInfoAsync(cachedPath);
        
        if (fileInfo.exists) {
          imageUrls[slide.id] = cachedPath;
        } else {
          // Download and cache the image
          const downloadResult = await FileSystem.downloadAsync(url, cachedPath);
          imageUrls[slide.id] = downloadResult.uri;
        }
      } catch (error: any) {
        console.error(`Error loading image for slide ${slide.id}:`, error);
        imageUrls[slide.id] = '';
      }
    }
    
    setSlideImages(imageUrls);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    preloadImages();
  }, [preloadImages]);

  const animateContent = useCallback((index: number) => {
    slideAnim.setValue(50);
    scaleAnim.setValue(0.8);
    rotateAnim.setValue(0);
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000, // Reduced from 2000 to 1000
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200, // Reduced from 400 to 200
          useNativeDriver: true,
        }),
        Animated.spring(rotateAnim, {
          toValue: 0,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim, rotateAnim]);

  useEffect(() => {
    slideAnim.setValue(50);
    animateContent(currentIndex);
  }, [currentIndex, animateContent, slideAnim]);

  useEffect(() => {
    const autoSlide = setInterval(() => {
      if (currentIndex < slides.length - 1) {
        setCurrentIndex((prevIndex) => prevIndex + 1);
        swiperRef.current?.scrollBy(1);
      } else {
        clearInterval(autoSlide);
      }
    }, 40000);

    return () => clearInterval(autoSlide);
  }, [currentIndex]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '5deg']
  });

  const handleGetStarted = async () => {
    try {
      // Mark that user has seen onboarding
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      // Navigate to login screen
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      navigation.navigate('Login');
    }
  };

  return (
    <Swiper
      ref={swiperRef}
      loop={false}
      showsPagination={false}
      index={currentIndex}
      onIndexChanged={(index) => {
        setCurrentIndex(index);
        animateContent(index);
      }}
      loadMinimal={true}
      loadMinimalSize={1}
      removeClippedSubviews={true}
    >
      {slides.map((slide, index) => (
        <View key={slide.id} style={styles.container}>
          <LinearGradient 
            colors={['#FFE4D9', '#FFFFFF']} 
            style={styles.gradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          >
            <View style={styles.contentContainer}>
              <Animated.View 
                style={[
                  styles.imageContainer,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim },
                      { rotate: spin }
                    ]
                  }
                ]}
              >
                {slideImages[slide.id] ? (
                  <Image 
                    source={{ uri: slideImages[slide.id] }} 
                    style={styles.image} 
                    resizeMode="contain"
                    onLoadStart={() => setIsLoading(true)}
                    onLoadEnd={() => setIsLoading(false)}
                  />
                ) : (
                  <View style={[styles.image, { backgroundColor: '#f0f0f0' }]} />
                )}
              </Animated.View>

              <Animated.View 
                style={[
                  styles.textContainer,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim }
                    ]
                  }
                ]}
              >
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </Animated.View>

              <View style={styles.navigationContainer}>
                {index < slides.length - 1 ? (
                  <View style={styles.bottomNavigation}>
                    <View style={styles.dotsContainer}>
                      {slides.map((_, dotIndex) => (
                        <Animated.View 
                          key={dotIndex} 
                          style={[
                            styles.dot,
                            index === dotIndex && styles.activeDot
                          ]} 
                        />
                      ))}
                    </View>

                    <TouchableOpacity 
                      style={styles.skipButton} 
                      onPress={() => navigation.navigate('SignUpScreen' as never)}
                    >
                      <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    <View style={styles.navigationButtons}>
                      <TouchableOpacity 
                        style={[styles.navButton, { opacity: index === 0 ? 0 : 1 }]}
                        onPress={() => {
                          if (index > 0) {
                            setCurrentIndex(index - 1);
                            swiperRef.current?.scrollBy(-1);
                          }
                        }}
                        disabled={index === 0}
                      >
                        <MaterialIcons name="chevron-left" size={35} color="#7E7E7E" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.navButton}
                        onPress={() => {
                          setCurrentIndex(index);
                          swiperRef.current?.scrollBy(1);
                        }}
                      >
                        <MaterialIcons name="chevron-right" size={35} color="#7E7E7E" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={[styles.getStartedButton, styles.buttonShadow]} 
                      onPress={handleGetStarted}
                    >
                      <Text style={styles.getStartedText}>Get Started</Text>
                    </TouchableOpacity>

                    {/* Terms & Privacy Text */}
                    <View style={styles.termsContainer}>
                      <Text style={styles.termsText}>
                        By continuing you accept to our{' '}
                        <Text 
                          style={styles.linkText} 
                          onPress={() => openDocument('terms')}
                        >
                          Terms & Conditions
                        </Text>{' '}
                        and{' '}
                        <Text 
                          style={styles.linkText} 
                          onPress={() => openDocument('privacy')}
                        >
                          Privacy Policy
                        </Text>.
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      ))}
    </Swiper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: height * 0.1,
    paddingBottom: height * 0.05,
  },
  imageContainer: {
    width: width * 0.8,
    height: height * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height * 0.05,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: width * 0.08,
    marginBottom: height * 0.15,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Poppins_600SemiBold',
    color: '#293646',
    marginBottom: height * 0.02,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginTop: 5,
  },
  navigationContainer: {
    width: '100%',
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: height * 0.05,
    zIndex: 3,
  },
  bottomNavigation: {
    width: '100%',
    height: 120,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    position: 'absolute',
    top: 50,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D9D9D9',
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#FF8447',
    borderRadius: 4,
  },
  skipButton: {
    position: 'absolute',
    alignSelf: 'flex-start',
    left: 5,
    bottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    borderRadius: 8,
    zIndex: 3,
  },
  skipText: {
    color: '#FF8447',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    textDecorationLine: 'underline',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 16,
    position: 'absolute',
    right: 20,
    bottom: 10,
    zIndex: 3,
  },
  navButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FADCDE',
    borderRadius: 30,
  },
  getStartedButton: {
    width: width * 0.9,
    height: 56,
    backgroundColor: '#F55100',
    justifyContent: 'center',
    borderRadius: 16,
    alignItems: 'center',
    alignSelf: 'center',
  },
  getStartedText: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.5,
  },
  buttonShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  termsContainer: {
    marginTop: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 14,
    color: '#595550',
    textAlign: 'center',
    fontFamily: 'LexendDeca_400Regular',
  },
  linkText: {
    fontSize: 14,
    color: '#FF8447',
    textDecorationLine: 'underline',
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default OnboardingScreen;
