import React, { useState, useEffect } from 'react';
import { auth, db } from '@/firebaseConfig';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import AppGradient from '@/app/components/AppGradient';
import HrMainLayout from '@/app/components/HrMainLayout';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { setDoc } from 'firebase/firestore';

import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/app/index';
const ratingOptions = [1, 2, 3, 4, 5];

const fallbackRoleIdMap: Record<string, string> = {
  'Telecaller': 'R2',
  'HR Manager': 'R4',
  'HR Head': 'R3',
  'BDM': 'R5',
  // Add more if needed
};

type PerformanceFormRouteProp = RouteProp<RootStackParamList, 'PerformanceForm'>;

export default function PerformanceForm() {

const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PerformanceFormRouteProp>();
  const employeeId = (route.params && 'employeeId' in route.params) ? route.params.employeeId : undefined;

  const [ratings, setRatings] = useState<{ [key: string]: number }>({});
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${today.getFullYear()}`;
  });

  const [overallRating, setOverallRating] = useState('');
  const [improvement, setImprovement] = useState('');
  const [employee, setEmployee] = useState({
    userId: '',
    employeeName: '',
    department: '',
    dept_id: '',
    designation: '',
    role: '',
    role_id: '',
  });

  const [submitterRole, setSubmitterRole] = useState({
    role: '',
    role_id: '',
  });

  const [questionsByTitle, setQuestionsByTitle] = useState<
    { title: string; title_id: string; questions: any[] }[]
  >([]);

  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      try {
        const userId = employeeId || auth.currentUser?.uid;
        if (!userId) {
          Alert.alert('Error', 'No employee ID available.');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          Alert.alert('Error', 'Employee not found.');
          return;
        }

        const userData = userDoc.data();
        const emp = {
          userId,
          employeeName: userData.name || '',
          department: userData.department || '',
          dept_id: userData.dept_id || '',
          designation: userData.designation || '',
          role: userData.role || '',
          role_id: userData.role_id || userData.roleId || fallbackRoleIdMap[userData.role] || '',
        };
        setEmployee(emp);

        if (!emp.dept_id) {
          Alert.alert('Error', 'No dept_id found for user.');
          return;
        }

        fetchQuestions(emp.dept_id);

        const submitterId = auth.currentUser?.uid;
        if (submitterId) {
          const submitterDoc = await getDoc(doc(db, 'users', submitterId));
          if (submitterDoc.exists()) {
            const data = submitterDoc.data();
            setSubmitterRole({
              role: data.role || '',
              role_id:
                data.role_id || data.roleId || fallbackRoleIdMap[data.role] || '',
            });
          }
        }
      } catch (err) {
        console.error('❌ Error fetching employee details:', err);
        Alert.alert('Error', 'Failed to load employee or department data');
      }
    };

    fetchEmployeeDetails();
  }, [employeeId]);

  const fetchQuestions = async (dept_id: string) => {
    try {
      const questionSnap = await getDocs(
        query(collection(db, 'questions'), where('dept_id', '==', dept_id))
      );

      const allQuestions = questionSnap.docs.map((doc) => doc.data());
      if (!allQuestions.length) {
        Alert.alert('No questions found for department');
        return;
      }

      const uniqueTitleIds = [
        ...new Set(allQuestions.map((q) => q.title_id).filter(Boolean)),
      ];

      const titleMap: { [key: string]: string } = {};
      for (const titleId of uniqueTitleIds) {
        const titleDoc = await getDocs(
          query(collection(db, 'question_title'), where('title_id', '==', titleId))
        );
        if (!titleDoc.empty) {
          const data = titleDoc.docs[0].data();
          titleMap[titleId] = data.title;
        } else {
          titleMap[titleId] = 'Untitled';
        }
      }

      const grouped: { [key: string]: any[] } = {};
      allQuestions.forEach((q) => {
        if (q.title_id) {
          if (!grouped[q.title_id]) grouped[q.title_id] = [];
          grouped[q.title_id].push(q);
        }
      });

      const final = Object.keys(grouped).map((titleId) => ({
        title_id: titleId,
        title: titleMap[titleId] || 'Untitled',
        questions: grouped[titleId],
      }));

      setQuestionsByTitle(final);
    } catch (err) {
      console.error('❌ Error fetching questions:', err);
      Alert.alert('Error', 'Failed to load questions');
    }
  };

  const handleRating = (questionId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [questionId]: value }));
  };

// ... (imports remain same)

const handleSubmit = async () => {
  if (!employee.userId) return Alert.alert('Invalid employee data');
  const userId = auth.currentUser?.uid || 'anonymous';
  const currentRole = submitterRole.role.toLowerCase();

  try {
    const batch = questionsByTitle.flatMap((group) =>
      group.questions.map((q) =>
        addDoc(collection(db, 'performance_reviews'), {
          userId: employee.userId,
          employeeName: employee.employeeName,
          designation: employee.designation,
          department: employee.department,
          employeeRole: employee.role || '',
          employeeRoleId: employee.role_id || '',
          section: group.title,
          question: q.question,
          questionId: q.question_id,
          rating: ratings[q.question_id] || 0,
          overallRating,
          improvement,
          date,
          status: 'pending',
          timestamp: serverTimestamp(),
          submittedBy: userId,
          submittedByRole: submitterRole.role || '',
          submittedByRoleId: submitterRole.role_id || '',

          // ✅ Role-based flags
          submittedByTelecaller: currentRole === 'telecaller',
          submittedByHrManager: currentRole === 'hr manager',
          submittedByHrHead: currentRole === 'hr head',
        })
      )
    );

    await Promise.all(batch);

    await setDoc(doc(db, 'authority_Approvel', employee.userId), {
      userId: employee.userId,
      name: employee.employeeName,
      designation: employee.designation,
      status: 'pending',
      timestamp: new Date().toISOString(),
    });

    Alert.alert('Submitted Successfully!');
    setRatings({});
    setOverallRating('');
    setImprovement('');

    navigation.navigate('PerformanceAppraisalForm', {
      employeeId: employee.userId,
    });
  } catch (err) {
    console.error('❌ Error submitting form:', err);
    Alert.alert('Error', 'Submission failed.');
  }
};


  useEffect(() => {
    const ratingValues = Object.values(ratings);
    if (!ratingValues.length) return setOverallRating('');
    const avg = (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1);
    setOverallRating(avg);
  }, [ratings]);


  return (
    <AppGradient>
      <HrMainLayout
        title="Performance Appraisal Form"
        showBackButton
        showDrawer
        showBottomTabs={false}
      >
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.employeeCard}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Employee ID</Text>
              <Text style={styles.cardValue}>{employee.userId}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Name</Text>
              <Text style={styles.cardValue}>{employee.employeeName}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Department</Text>
              <Text style={styles.cardValue}>{employee.department}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Designation</Text>
              <Text style={styles.cardValue}>{employee.designation}</Text>
            </View>
          </View>

          {questionsByTitle.map((group, groupIdx) => (
            <View key={group.title_id} style={styles.questionBox}>
              <Text style={styles.sectionTitle}>{`${groupIdx + 1}. ${group.title}`}</Text>
              {group.questions.map((q, qIdx) => {
                const key = q.question_id;
                return (
                  <View key={key} style={{ marginTop: 10 }}>
                    <Text style={styles.subQuestion}>
                      {String.fromCharCode(65 + qIdx)}. {q.question}
                    </Text>
                    <Text style={styles.ratingNote}>Rate from 1 to 5 (5 being the best)</Text>
                    <View style={styles.ratingRow}>
                      {ratingOptions.map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.ratingButton,
                            ratings[key] === option && styles.selectedRatingButton,
                          ]}
                          onPress={() => handleRating(key, option)}
                        >
                          <Text
                            style={[
                              styles.ratingText,
                              ratings[key] === option && styles.selectedRatingText,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          <Text style={styles.inputLabel}>Date</Text>
          <TextInput style={styles.input} value={date} editable={false} />

          <Text style={styles.inputLabel}>Overall Rating</Text>
          <TextInput
                    style={styles.input}
                        value={overallRating}
                        editable={false}
          />


          <Text style={styles.inputLabel}>Areas of Improvement</Text>
          <View style={styles.textAreaContainer}>
            <TextInput
              style={styles.textArea}
              multiline
              maxLength={120}
              placeholder="Write comments..."
              value={improvement}
              onChangeText={setImprovement}
            />
            <Text style={styles.charCount}>{`${improvement.length}/120`}</Text>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </ScrollView>
      </HrMainLayout>
    </AppGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  employeeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 16,
    color: '#1F2A37',
    fontFamily: 'LexendDeca_500Medium',
  },
  cardValue: {
    fontSize: 16,
    color: '#818181',
    fontFamily: 'LexendDeca_500Medium',
  },
  questionBox: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1F2A37',
    fontFamily: 'LexendDeca_500Medium',
  },
  subQuestion: {
    marginTop: 5,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
  },
  ratingNote: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#242426',
    marginVertical: 5,
    fontFamily: 'Inter_400Regular',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selectedRatingButton: {
    backgroundColor: '#FFEDE4',
    borderColor: '#FF8447',
  },
  ratingText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
  },
  selectedRatingText: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_400Regular',
  },
  inputLabel: {
    marginTop: 10,
    marginBottom: 5,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#000000',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    fontFamily: 'LexendDeca_400Regular',
  },
  textAreaContainer: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 30,
    minHeight: 100,
  },
  textArea: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'LexendDeca_222Regular',
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 14,
    color: '#A4A4A4',
    fontFamily: 'LexendDeca_500Medium',
  },
  submitButton: {
    backgroundColor: '#ff7a00',
    paddingVertical: 12,
    paddingHorizontal: 60,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
    alignSelf: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
