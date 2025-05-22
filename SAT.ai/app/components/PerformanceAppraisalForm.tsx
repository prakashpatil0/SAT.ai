import React, { useEffect, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import AppGradient from '@/app/components/AppGradient';
import HrMainLayout from '@/app/components/HrMainLayout';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const { width } = Dimensions.get('window');

type PerformanceAppraisalFormRouteParams = {
  employeeId?: string;
};

const PerformanceAppraisalForm = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState<string | null>(null);
  const [finalRating, setFinalRating] = useState<number | null>(null);
  const [designation, setDesignation] = useState('');
  const [name, setName] = useState('');
const [reviewDate, setReviewDate] = useState<string | null>(null);

  const route = useRoute<RouteProp<Record<string, PerformanceAppraisalFormRouteParams>, string>>();
  const { employeeId } = route.params || {};

  useEffect(() => {
    if (employeeId) {
      fetchAuthorityStatus(employeeId);
    }
  }, [employeeId]);

  const fetchAuthorityStatus = async (empId: string) => {
    try {
      const q = query(
        collection(db, 'authority_Approvel'),
        where('userId', '==', empId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setStatus(data.status || '');
        setDescription(data.description || null);
        setFinalRating(data.finalRating || null);
        setName(data.name || '');
        setDesignation(data.designation || '');
          const date = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : null;
  setReviewDate(date);
      } else {
        setStatus(null);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) return <Text>Loading...</Text>;

    switch (status?.toLowerCase()) {
      case 'pending':
        return (
          <View style={styles.noResultContainer}>
             <Image
                source={require('@/assets/images/sit.png')}
                style={styles.noDataImage}
                resizeMode="contain"
              />
            <Text style={styles.noActiveTitle}>We’re Finalizing Your Performance Review</Text>
            <Text style={styles.noActiveSubtitle}>
           Sit back and relax results will be available soon! You’ll receive an email once they’re ready.
            </Text>
          </View>
        );

      case 'approved':
      case 'cancel':
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.labelText}>Reviewed by Authority</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.subText}>Employee Name: {name}</Text>
                <Text style={styles.subText}>Designation: {designation}</Text>
                <Text style={styles.subText}>Last Reviewed on: {reviewDate || 'N/A'}</Text> 
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingText}>Final Rating: {finalRating || 'N/A'}</Text>
                <AntDesign name="star" size={14} color="#FFD700" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.commentLabel}>Comments on performance</Text>
              <View style={styles.commentBox}>
                <Text style={styles.commentText}>
                  {description || 'No comments provided yet.'}
                </Text>
              </View>
            </View>
            <View style={styles.noResultContainer}>
              <Image
                source={require('@/assets/images/pastimage.png')}
                style={styles.noDataImage}
                resizeMode="contain"
              />
              <Text style={styles.noActiveTitle}>No Active Performance Review at the Moment</Text>
              <Text style={styles.noActiveSubtitle}>
               This is where you'll find it once it's ready check back soon!
              </Text>
            </View>
          </>
        );

      default:
        return (
          <View style={styles.noResultContainer}>
            <Text style={styles.noActiveTitle}>Form Not Yet Submitted</Text>
            <Text style={styles.noActiveSubtitle}>
              Please submit your performance appraisal form.
            </Text>
          </View>
        );
    }
  };

  return (
    <AppGradient>
      <HrMainLayout
        showDrawer
        showBackButton={true}
        showBottomTabs={false}
        title={'Performance Appraisal Form'}
      >
        <ScrollView contentContainerStyle={styles.container}>
          {renderContent()}
        </ScrollView>
      </HrMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    marginBottom: 20,
  },
  rowBetween: {
    flexDirection: 'column',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 16,
    color: '#1F2A37',
    fontFamily: 'LexendDeca_500Medium',
  },
  subText: {
    fontSize: 16,
    // color: '#818181',
    fontFamily: 'LexendDeca_500Medium',
  },
  ratingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#1F2A37',
  },
  commentLabel: {
    fontSize: 16,
    color: '#1F2A37',
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 10,
  },
  commentBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  commentText: {
    fontSize: 16,
    color: '#515151',
    fontFamily: 'LexendDeca_500Medium',
    lineHeight: 18,
  },
  noResultContainer: {
    alignItems: 'center',
    padding: 26,
  },
  noDataImage: {
    width: width * 0.65,
    height: width * 0.55,
    marginBottom: 16,
  },
  noActiveTitle: {
    fontSize: 20,
    textAlign: 'center',
    fontFamily: 'LexendDeca_600SemiBold',
    marginBottom: 8,
    color: '#262626',
  },
  noActiveSubtitle: {
    fontSize: 16,
    color: '#262626',
    textAlign: 'center',
    paddingHorizontal: 30,
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default PerformanceAppraisalForm;
