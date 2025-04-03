import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: "Welcome To SAT.ai",
    description: "SAT.ai is designed to streamline sales tracking, improve productivity, and provide real-time insights for telecallers and BDMs.",
    image: require('../../assets/images/Slide1.png'),
  },
  {
    id: 2,
    title: "Set & Track Targets",
    description: "Ensure your team stays on track with clear weekly targets and real-time performance monitoring. Keep motivation high and goals within reach.",
    image: require('../../assets/images/Slide2.png'),
  },
  {
    id: 3,
    title: "Easy Call Logging",
    description: "For telecallers - Log calls effortlessly, track duration, categorize leads (Prospect, Suspect, Closing), and schedule follow-ups to maximize conversions.",
    image: require('../../assets/images/Slide3.png'),
  },
  {
    id: 4,
    title: "Smart Meeting Logs",
    description: "For BDMs - Add meeting details, track deal closures, and provide managers with visibility into field activities and sales performance.",
    image: require('../../assets/images/Screen4.png'),
  },
  {
    id: 5,
    title: "Get Started",
    description: "Boost productivity and drive results with SAT.ai, start tracking and achieving your sales goals now!",
    image: require('../../assets/images/Screen5.png'),
  }
];

const OnboardingScreen = () => {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef<Swiper | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const animateContent = (index: number) => {
    // Reset animations
    slideAnim.setValue(50);
    scaleAnim.setValue(0.8);
    rotateAnim.setValue(0);
    fadeAnim.setValue(0);

    // Complex animation sequence
    Animated.parallel([
      // Fade and slide animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // Scale animation with bounce
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      // Subtle rotation
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 400,
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
  };

  useEffect(() => {
    slideAnim.setValue(50); // Reset slide position
    animateContent(currentIndex);
  }, [currentIndex]);

  // Auto-slide every 30 seconds
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
              {/* Image Container with Enhanced Animation */}
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
                <Image source={slide.image} style={styles.image} resizeMode="contain" />
              </Animated.View>

              {/* Text Content with Enhanced Animation */}
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

              {/* Navigation Buttons */}
              <View style={styles.navigationContainer}>
                {index < slides.length - 1 ? (
                  <View style={styles.bottomNavigation}>
                    <View style={styles.dotsContainer}>
                      {slides.map((_, dotIndex) => (
                        <Animated.View 
                          key={dotIndex} 
                          style={[
                            styles.dot,
                            index === dotIndex && styles.activeDot,
                            {
                              transform: [{
                                scale: index === dotIndex ? 1 : 1
                              }]
                            }
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
                    {/* )} */}

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
                        <MaterialIcons name="chevron-left" size={35} color="#F55100" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.navButton}
                        onPress={() => {
                          setCurrentIndex(index );
                          swiperRef.current?.scrollBy(1);
                        }}
                      >
                        <MaterialIcons name="chevron-right" size={35} color="#F55100" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.getStartedButton, styles.buttonShadow]} 
                    onPress={() => navigation.navigate('Login' as never)}
                  >
                    <Text style={styles.getStartedText}>Get Started</Text>
                  </TouchableOpacity>
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
    backgroundColor: '#F55100',
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
    color: '#F55100',
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
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
});

export default OnboardingScreen;
