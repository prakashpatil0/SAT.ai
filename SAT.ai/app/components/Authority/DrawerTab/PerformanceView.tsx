import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import AppGradient from '@/app/components/AppGradient';
import HrMainLayout from '@/app/components/HrMainLayout';

type RootStackParamList = {
  PerformanceView: {
    employee: {
      name: string;
      designation: string;
      userId: string;
      department: string; // 👈 add this
    };
  };
};

type PerformanceViewRouteProp = RouteProp<RootStackParamList, 'PerformanceView'>;

type RatingRow = {
  question: string;
  hrManager?: number;
  hrHead?: number;
  employee?: number;
};

export default function PerformanceView() {
  const route = useRoute<PerformanceViewRouteProp>();
  const { employee } = route.params;

  const [ratingData, setRatingData] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [finalRating, setFinalRating] = useState<number>(0);

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return '#28a745';
    if (rating === 3) return '#ffeb3b';
    if (rating === 2) return '#ff9800';
    return '#f44336';
  };

  useEffect(() => {
    fetchRatings();
  }, [employee.userId]);

  const fetchRatings = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'performance_reviews'));
      const temp: { [question: string]: RatingRow } = {};

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const role = (data.submittedByRole || '').toLowerCase().trim();
        const rating = data.rating;
        const question = data.question;
        const userId = data.userId;

        if (userId?.trim() !== employee.userId?.trim()) return;
        if (!question || rating === undefined || !role) return;

        if (!temp[question]) {
          temp[question] = { question };
        }

        if (role === 'hr manager') temp[question].hrManager = rating;
        else if (role === 'hr head') temp[question].hrHead = rating;
        else if (role === 'employee' || role === 'bdm' || role === 'telecaller') temp[question].employee = rating;
      });

      setRatingData(Object.values(temp));
    } catch (error) {
      console.error('❌ Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

 const handleSubmitFinalRating = async () => {
  if (!description) {
    Alert.alert('Error', 'Please provide a final rating and description');
    return;
  }

  const calculatedRating = calculateAverageRating();

  setUpdating(true);

  try {
    const q = query(collection(db, 'performance_reviews'), where('userId', '==', employee.userId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      Alert.alert('Error', 'No performance records found for this employee.');
      return;
    }

    const updatePromises = querySnapshot.docs.map((docSnap) =>
      updateDoc(doc(db, 'performance_reviews', docSnap.id), {
        status: 'approved',
        finalRating: calculatedRating,
        description,
      })
    );

    await Promise.all(updatePromises);

    await setDoc(doc(db, 'authority_Approvel', employee.userId), {
      userId: employee.userId,
      name: employee.name,
      designation: employee.designation,
      department: employee.department, // 👈 add this
      finalRating: calculatedRating,
      description,
      status: 'approved',
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Approved: Final Rating Saved:', calculatedRating);
    Alert.alert('Success', 'Performance review approved and saved!');
  } catch (error) {
    console.error('❌ Error approving performance:', error);
    Alert.alert('Error', 'Failed to approve performance review.');
  } finally {
    setUpdating(false);
  }
};


const handleReject = async () => {
  if (!description) {
    Alert.alert('Error', 'Please provide a reason for rejection');
    return;
  }

  const calculatedRating = calculateAverageRating();

  Alert.alert('Confirm Rejection', 'Are you sure you want to reject this review?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Reject',
      onPress: async () => {
        setUpdating(true);
        try {
          const q = query(collection(db, 'performance_reviews'), where('userId', '==', employee.userId));
          const querySnapshot = await getDocs(q);

          const updatePromises = querySnapshot.docs.map((docSnap) =>
            updateDoc(doc(db, 'performance_reviews', docSnap.id), {
              status: 'cancel',
              finalRating: calculatedRating,
              description,
            })
          );

          await Promise.all(updatePromises);

          await setDoc(doc(db, 'authority_Approvel', employee.userId), {
            userId: employee.userId,
            name: employee.name,
            designation: employee.designation,
            department: employee.department, // 👈 add this
            finalRating: calculatedRating,
            description,
            status: 'cancel',
            timestamp: new Date().toISOString(),
          });

          console.log('❌ Rejected: Final Rating Saved:', calculatedRating);
          Alert.alert('Rejected', 'Performance review rejected and saved!');
        } catch (error) {
          console.error('❌ Error rejecting review:', error);
          Alert.alert('Error', 'Failed to reject performance review.');
        } finally {
          setUpdating(false);
        }
      },
    },
  ]);
};

const calculateAverageRating = (): number => {
  const ratings = [
    ratingData.map((item) => item.hrManager).filter((v): v is number => typeof v === 'number'),
    ratingData.map((item) => item.hrHead).filter((v): v is number => typeof v === 'number'),
    ratingData.map((item) => item.employee).filter((v): v is number => typeof v === 'number'),
  ];

  const sum =
    (ratings[0]?.reduce((acc, curr) => acc + curr, 0) ?? 0) +
    (ratings[1]?.reduce((acc, curr) => acc + curr, 0) ?? 0) +
    (ratings[2]?.reduce((acc, curr) => acc + curr, 0) ?? 0);

  const count =
    (ratings[0]?.length ?? 0) +
    (ratings[1]?.length ?? 0) +
    (ratings[2]?.length ?? 0);

  return count > 0 ? Number((sum / count).toFixed(1)) : 0;
};

  useEffect(() => {
    const ratings = [
      ratingData.map((item) => item.hrManager).filter((v): v is number => typeof v === 'number'),
      ratingData.map((item) => item.hrHead).filter((v): v is number => typeof v === 'number'),
      ratingData.map((item) => item.employee).filter((v): v is number => typeof v === 'number'),
    ];

    const sum =
      (ratings[0]?.reduce((acc, curr) => acc + curr, 0) ?? 0) +
      (ratings[1]?.reduce((acc, curr) => acc + curr, 0) ?? 0) +
      (ratings[2]?.reduce((acc, curr) => acc + curr, 0) ?? 0);

    const count =
      (ratings[0]?.length ?? 0) +
      (ratings[1]?.length ?? 0) +
      (ratings[2]?.length ?? 0);

    const averageRating = count > 0 ? sum / count : 0;

    setFinalRating(averageRating);
  }, [ratingData]);

  return (
    <AppGradient>
      <HrMainLayout showDrawer showBackButton showBottomTabs={false} title="Performance Ratings">
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
          <View style={styles.employeeHeader}>
  <Text style={styles.employeeLabel}><Text style={styles.boldLabel}>Emp ID:</Text> {employee.userId}</Text>
  <Text style={styles.employeeLabel}><Text style={styles.boldLabel}>Employee Name:</Text> {employee.name}</Text>
  <Text style={styles.employeeLabel}><Text style={styles.boldLabel}>Department:</Text> {employee.department || 'N/A'}</Text>
  <Text style={styles.employeeLabel}><Text style={styles.boldLabel}>Designation:</Text> {employee.designation}</Text>
  <Text style={styles.employeeLabel}><Text style={styles.boldLabel}>Date:</Text> {new Date().toLocaleDateString()}</Text>
</View>


          {loading ? (
            <ActivityIndicator size="large" color="#28a745" />
          ) : (
            <ScrollView horizontal>
              <View style={styles.tableCard}>
                <View style={[styles.row, styles.headerRow]}>
                  <Text style={[styles.cell, styles.headerCell, styles.colQuestion]}>Questions</Text>
                  <Text style={[styles.cell, styles.headerCell, styles.colRating]}>HR Executive</Text>
                  <Text style={[styles.cell, styles.headerCell, styles.colRating]}>HR Head</Text>
                  <Text style={[styles.cell, styles.headerCell, styles.colRating]}>Self</Text>
                </View>

                {ratingData.map((item, index) => (
                  <View key={index} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
<Text style={[styles.cell, styles.colQuestion]}>
  {index + 1}. {item.question}
</Text>
                    <View style={[styles.circle, { backgroundColor: getRatingColor(item.hrManager || 0) }]}>
                      <Text style={styles.circleText}>{item.hrManager ?? '-'}</Text>
                    </View>
                    <View style={[styles.circle, { backgroundColor: getRatingColor(item.hrHead || 0) }]}>
                      <Text style={styles.circleText}>{item.hrHead ?? '-'}</Text>
                    </View>
                    <View style={[styles.circle, { backgroundColor: getRatingColor(item.employee || 0) }]}>
                      <Text style={styles.circleText}>{item.employee ?? '-'}</Text>
                    </View>
                  </View>
                ))}

                <View style={[styles.row, styles.overallRow]}>
                  <Text style={[styles.cell, styles.colQuestion, styles.overallText]}>Rating Summary</Text>
                  <View style={[styles.circle, { backgroundColor: getRatingColor(Number(finalRating)) }]}>
                    <Text style={styles.circleText}>{finalRating.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          <View style={styles.approveContainer}>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              multiline
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.approveButton, updating && { opacity: 0.6 }]}
                onPress={handleSubmitFinalRating}
                disabled={updating}
              >
                <Text style={styles.approveText}>
                  {updating ? 'Approving...' : 'Approve'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rejectButton, updating && { opacity: 0.6 }]}
                onPress={handleReject}
                disabled={updating}
              >
                <Text style={styles.rejectText}>
                  {updating ? 'Rejecting...' : 'Reject'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </HrMainLayout>
    </AppGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  employeeHeader: {
    marginBottom: 16,
    backgroundColor: '#eaf4ff',
    padding: 12,
    borderRadius: 8,
  },
  employeeInfo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0056b3',
  },
  employeeLabel: {
  fontSize: 14,
  color: '#333',
  marginBottom: 4,
  fontFamily: 'LexendDeca_400Regular',
},

boldLabel: {
  fontWeight: 'bold',
  color: '#0056b3',
},

  tableCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minWidth: 400,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: '#ffb347',
  },
  cell: {
    fontSize: 14,
    color: '#333',
    textAlign: 'left',
    paddingLeft: 8,
  },
  headerCell: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'left',
    paddingLeft: 8,
  },
  colQuestion: {
    width: 250,
    paddingLeft: 4,
  },
  colRating: {
    width: 90,
    paddingLeft: 4,
  },
  evenRow: {
    backgroundColor: '#f9f9f9',
  },
  oddRow: {
    backgroundColor: '#ffffff',
  },
  approveContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  descriptionInput: {
    width: '100%',
    minHeight: 80,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    fontSize: 15,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  approveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  approveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    marginLeft: 41,
  },
  circleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  overallRow: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  overallText: {
    fontWeight: '700',
    color: '#2e7d32',
  },
  rejectText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  
});
