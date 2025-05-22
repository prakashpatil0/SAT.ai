import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AppGradient from '@/app/components/AppGradient';
import HrMainLayout from '@/app/components/HrMainLayout';
import { db,auth } from '@/firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  query,
  getDoc,
  where,
} from 'firebase/firestore';

interface Employee {
  id: string;
  name: string;
  designation: string;
  email?: string;
  joiningDate?: string;
}

type RootStackParamList = {
  PerformanceForm: { employeeId: string; employeeName: string };
  PerformanceAppraisalForm: {
    employeeId: string;
    performanceData?: any;
    status: string;
    description?: string;
    finalRating?: number;
  };
  AllEmployeeList: undefined;
};

export default function AllEmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users: Employee[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data?.name && data?.designation) {
            users.push({ id: doc.id, ...data } as Employee);
          }
        });
        setEmployees(users);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

 const handleViewForm = async (emp: Employee) => {
  try {
    const q = query(collection(db, 'authority_Approvel'), where('userId', '==', emp.id));
    const querySnapshot = await getDocs(q);
    const currentUserId = auth.currentUser?.uid;

    // Get current user's role
    const currentUserDoc = await getDoc(doc(db, 'users', currentUserId || ''));
    const currentUserRole = currentUserDoc.exists() ? currentUserDoc.data().role?.toLowerCase() : '';

    // 🔍 Check if this role already submitted
    const reviewQ = query(
      collection(db, 'performance_reviews'),
      where('userId', '==', emp.id),
      where('submittedByRole', '==', currentUserRole)
    );
    const reviewSnapshot = await getDocs(reviewQ);

    const hasSubmitted = !reviewSnapshot.empty;

    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      const status = (docData.status || '').toLowerCase();

      if (status === 'pending' && !hasSubmitted) {
        // ✅ Not yet submitted by this role
        navigation.navigate('PerformanceForm', {
          employeeId: emp.id,
          employeeName: emp.name,
        });
      } else {
        // 🔁 Already submitted or finalized
        navigation.navigate('PerformanceAppraisalForm', {
          employeeId: emp.id,
          performanceData: [docData],
          status,
          description: docData.description || '',
          finalRating: docData.finalRating || 0,
        });
      }
    } else {
      // No authority record, show form
      navigation.navigate('PerformanceForm', {
        employeeId: emp.id,
        employeeName: emp.name,
      });
    }
  } catch (error) {
    console.error('❌ Error fetching performance status:', error);
    Alert.alert('Error', 'Could not fetch review status. Try again later.');
  }
};


  return (
    <AppGradient>
      <HrMainLayout
        showDrawer
        showBackButton
        showBottomTabs={false}
        title="List of Employees for Performance Evaluation"
      >
        <ScrollView style={styles.container}>
          {loading ? (
            <ActivityIndicator size="large" color="#007B55" />
          ) : employees.length === 0 ? (
            <Text style={styles.noDataText}>No employee data found.</Text>
          ) : (
            employees.map(emp => (
              <TouchableOpacity
                key={emp.id}
                onPress={() => toggleExpand(emp.id)}
                activeOpacity={0.9}
                style={styles.infoCard}
              >
                <View style={styles.row}>
                  <Text style={styles.name}>{emp.name}</Text>
                  <Text style={styles.designation}>{emp.designation}</Text>
                </View>

                {expandedId === emp.id && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailText}>Employee ID: {emp.id}</Text>
                    <Text style={styles.detailText}>Email: {emp.email || 'N/A'}</Text>
                    <Text style={styles.detailText}>Joining Date: {emp.joiningDate || 'N/A'}</Text>
                    <View style={styles.buttonRow}>
                      <TouchableOpacity onPress={() => handleViewForm(emp)}>
                        <Text style={styles.labelButton}>View Form</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggleExpand(emp.id)}>
                        <Text style={styles.labelButton}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </HrMainLayout>
    </AppGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  designation: {
    fontSize: 16,
    color: '#777',
  },
  detailsSection: {
    marginTop: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  labelButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontWeight: '600',
    color: '#333',
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
});
