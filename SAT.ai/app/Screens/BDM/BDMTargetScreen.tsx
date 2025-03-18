import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import BDMMainLayout from '@/app/components/BDMMainLayout';

const BDMTargetScreen = () => {
  const navigation = useNavigation();

  return (
    <BDMMainLayout title="Weekly Target" showBackButton showDrawer={true} showBottomTabs={true}>
      <View style={styles.container}>
        <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {/* Header */}
            <View style={styles.header}>
              {/* <TouchableOpacity onPress={() => navigation.goBack()}>
                <MaterialIcons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity> */}
              {/* <Text style={styles.headerTitle}>Weekly Target</Text> */}
              <Image
                source={{ uri: 'https://via.placeholder.com/40' }}
                style={styles.profileImage}
              />
            </View>

            {/* Achievement Card */}
            <View style={styles.card}>
              <Text style={styles.achievementText}>
                Last week you achieved <Text style={styles.achievementHighlight}>87%</Text> of your target!
              </Text>
              <TouchableOpacity 
                style={styles.reportLink}
                onPress={() => navigation.navigate('BDMViewFullReport' as never)}
              >
                <Text style={styles.reportText}>View Full Report</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FF8447" />
              </TouchableOpacity>
            </View>

            {/* This Week Card */}
            <View style={styles.card}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>This Week</Text>
                <Text style={styles.daysLeft}>4 days to go!</Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: '40%' }]} />
              </View>
              <Text style={styles.progressText}>40%</Text>

              {/* Target Details */}
              <View style={styles.targetDetails}>
                {/* Column Headers */}
                <View style={styles.columnHeaders}>
                  <View style={styles.spacer} />
                  <View style={styles.valueColumns}>
                    <Text style={styles.columnLabel}>Achieved</Text>
                    <Text style={[styles.columnLabel, styles.targetColumn]}>Target</Text>
                  </View>
                </View>

                {/* Rows */}
                <View style={styles.row}>
                  <Text style={styles.label}>Positive Leads</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>20</Text>
                    <Text style={styles.target}>50</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>No. of Meetings</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>12</Text>
                    <Text style={styles.target}>30</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Meeting Duration</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>08 hrs</Text>
                    <Text style={styles.target}>20 hrs</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Closing</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>₹21,864</Text>
                    <Text style={styles.target}>₹50,000</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    </BDMMainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  achievementText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  achievementHighlight: {
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  reportText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginRight: 8,
    textDecorationLine: 'underline',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  daysLeft: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF8447',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  targetDetails: {
    gap: 16,
    marginTop: 8,
  },
  columnHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  spacer: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  valueColumns: {
    flexDirection: 'row',
    width: 180,
    justifyContent: 'space-between',
  },
  targetColumn: {
    color: '#FF8447',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    flex: 1,
  },
  achieved: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    width: 70,
    textAlign: 'center',
  },
  target: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    width: 70,
    textAlign: 'center',
  },
});

export default BDMTargetScreen;