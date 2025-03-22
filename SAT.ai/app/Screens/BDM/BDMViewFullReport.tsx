import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import App from '@/app';
import AppGradient from '@/app/components/AppGradient';

const BDMViewFullReport = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('Weekly');
  const periods = ['Weekly', 'Quarterly', 'Half Yearly'];

  // Data for different periods
  const chartData = {
    Weekly: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      datasets: [{
        data: [67, 58, 76, 85, 83],
        color: (opacity = 1) => `rgba(255, 132, 71, ${opacity})`,
        strokeWidth: 2
      }]
    },
    Quarterly: {
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{
        data: [67, 58, 97],
        color: (opacity = 1) => `rgba(255, 132, 71, ${opacity})`,
        strokeWidth: 2
      }]
    },
    'Half Yearly': {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        data: [67, 58, 76, 85, 85, 97],
        color: (opacity = 1) => `rgba(255, 132, 71, ${opacity})`,
        strokeWidth: 2
      }]
    }
  };

  return (
    <AppGradient>
    <BDMMainLayout showBottomTab={true} title="Weekly Target">
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
      {/* <BDMScreenHeader title="Weekly Target" /> */}

      {/* Period Selection */}
      <View style={styles.periodContainer}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.selectedPeriodButton
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodText,
              selectedPeriod === period && styles.selectedPeriodText
            ]}>
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Graph */}
      <View style={styles.graphContainer}>  
        <LineChart
          data={chartData[selectedPeriod as keyof typeof chartData]}
          width={Dimensions.get('window').width - 32}
          height={400}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: 'white',
            backgroundGradientTo: 'white',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(128, 128, 128, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(128, 128, 128, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#FF8447',
            },
            propsForBackgroundLines: {
              strokeDasharray: '',
              stroke: '#E5E7EB',
            },
            propsForVerticalLabels: {
              fontSize: 12,
              fontFamily: 'LexendDeca_400Regular',
            },
            propsForHorizontalLabels: {
              fontSize: 12,
              fontFamily: 'LexendDeca_400Regular',
            }
          }}
          bezier
          style={styles.graph}
          withVerticalLines={false}
          withHorizontalLines={true}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          fromZero={true}
          segments={10}
          yAxisLabel=""
          yAxisSuffix="%"
        />
      </View>
    </LinearGradient>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  selectedPeriodButton: {
    backgroundColor: '#FF8447',
  },
  periodText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedPeriodText: {
    color: 'white',
    fontFamily: 'LexendDeca_500Medium',
  },
  graphContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  graph: {
    marginVertical: 8,
    borderRadius: 16,
  }
});

export default BDMViewFullReport;