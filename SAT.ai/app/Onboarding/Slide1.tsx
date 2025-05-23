import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Platform, Linking, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
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

  const preloadImages = useCallback(async () => {
    const cacheDir = `${FileSystem.cacheDirectory}onboarding_images/`;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });

    const imagePromises = slides.map(async (slide) => {
      try {
        const imageRef = ref(storage, slide.imageUrl);
        const url = await getDownloadURL(imageRef);
        const cachedPath = `${cacheDir}${slide.id}.jpg`;
        const fileInfo = await FileSystem.getInfoAsync(cachedPath);

        if (fileInfo.exists) {
          return { id: slide.id, uri: cachedPath };
        } else {
          const downloadResult = await FileSystem.downloadAsync(url, cachedPath);
          return { id: slide.id, uri: downloadResult.uri };
        }
      } catch (error) {
        console.error(`Error loading image for slide ${slide.id}:`, error);
        return { id: slide.id, uri: '' };
      }
    });

    const results = await Promise.all(imagePromises);
    const imageUrls = results.reduce((acc, { id, uri }) => {
      acc[id] = uri;
      return acc;
    }, {} as { [key: number]: string });

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
          duration: 1000,
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
          duration: 200,
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
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      navigation.navigate('Login');
    }
  };

  return (
    <View style={styles.container}>
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
          <View key={slide.id} style={styles.slideContainer}>
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

                {index === slides.length - 1 && (
                  <View style={styles.termsContainer}>
                    <TouchableOpacity 
                      style={[styles.getStartedButton, styles.buttonShadow]} 
                      onPress={handleGetStarted}
                    >
                      <Text style={styles.getStartedText}>Get Started</Text>
                    </TouchableOpacity>
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
                )}
              </View>
            </LinearGradient>
          </View>
        ))}
      </Swiper>

      {/* Static Navigation Elements */}
      {currentIndex < slides.length - 1 && (
        <View style={styles.navigationContainer}>
          <View style={styles.dotsContainer}>
            {slides.map((_, dotIndex) => (
              <Animated.View 
                key={dotIndex} 
                style={[
                  styles.dot,
                  currentIndex === dotIndex && styles.activeDot
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
              style={[styles.navButton, { opacity: currentIndex === 0 ? 0 : 1 }]}
              onPress={() => {
                if (currentIndex > 0) {
                  setCurrentIndex(currentIndex - 1);
                  swiperRef.current?.scrollBy(-1);
                }
              }}
              disabled={currentIndex === 0}
            >
              <MaterialIcons name="chevron-left" size={35} color="#7E7E7E" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => {
                if (currentIndex < slides.length - 1) {
                  swiperRef.current?.scrollBy(1);
                }
              }}
            >
              <MaterialIcons name="chevron-right" size={35} color="#7E7E7E" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  slideContainer: {
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
    zIndex: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    position: 'absolute',
    top: -70,
  },
  dot: {
    width: 20,
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
    marginTop: -40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 14,
    marginTop: 10,
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