import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AppGradient from "@/app/components/AppGradient";
import AuthorityMainLayout from "@/app/components/AuthorityMainLayout";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

interface Employee {
  id: string;
  name: string;
  designation: string;
    department: string; // ✅ Add this
  [key: string]: any;
}

export default function EmployeeList() {
  const navigation = useNavigation<any>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchEmployees = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const users: Employee[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data?.name && data?.designation && data?.department) {
          users.push({ id: doc.id, ...data } as Employee);
        }
      });
      setEmployees(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <AppGradient>
      <AuthorityMainLayout
        showDrawer
        showBackButton
        showBottomTabs={false}
        title="List of Employees for Performance Evaluation"
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#007B55" />
          ) : employees.length === 0 ? (
            <Text style={styles.noDataText}>No employee data found.</Text>
          ) : (
            employees.map((emp) => (
              <TouchableOpacity
                key={emp.id}
                style={styles.infoCard}
                onPress={() => {
  console.log("👤 Selected Employee ID:", emp.id);
  navigation.navigate("PerformanceView", {
    employee: {
      name: emp.name,
      designation: emp.designation,
      userId: emp.id,
       department: emp.department, // ✅ Must be explicitly passed
    },
  });
}}

              >
                <View style={styles.row}>
                  <Text style={styles.name}>{emp.name}</Text>
                  <Text style={styles.designation}>{emp.designation}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </AuthorityMainLayout>
    </AppGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  designation: {
    fontSize: 16,
    color: "#555",
    fontWeight: "400",
  },
  noDataText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 50,
  },
});
