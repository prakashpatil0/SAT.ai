import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Image } from "expo-image";
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import { LinearGradient } from "expo-linear-gradient";
import BDMMainLayout from '@/app/components/BDMMainLayout';
import App from "@/app";
import AppGradient from "@/app/components/AppGradient";


const BDMReportScreen = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSubmit = () => {
    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 15000);
  };

  return (
    <AppGradient>
    <BDMMainLayout title="Daily Report" showBackButton>
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
        {/* <BDMScreenHeader title="Daily Report" /> */}
        <View style={styles.contentContainer}>
          {/* Input Fields Section */}
          <View style={styles.inputContainer}>
            <Text style={styles.dateText}>23 January (Thursday)</Text>
            <Text style={styles.label}>Number of Meetings</Text>
            <TextInput
              style={styles.input}
              placeholder="12"
              keyboardType="numeric" readOnly
            />

            <Text style={styles.label}>Meeting Duration</Text>
            <TextInput
              style={styles.input}
              placeholder="1 hr 20 mins"
              keyboardType="default" readOnly
            />

            <Text style={styles.label}>Positive Leads</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Positive Leads"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Closing Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="₹   Enter Closing Amount"
              keyboardType="numeric"
            />

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Popup Modal */}
        <Modal
          transparent={true}
          visible={modalVisible}
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>

              <Image
                source={require("@/assets/images/mail.gif")}
                style={styles.gif}
                contentFit="contain"
              />
              <Text style={styles.modalTitle}>Report Submitted Successfully!</Text>
              <Text style={styles.modalSubtitle}>
                Your report has been recorded. Keep up the great work!
              </Text>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </ScrollView>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 20,
  },
  dateText: {
    fontSize: 20,
    color: "#FF8447",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "LexendDeca_500Medium",
  },
  inputContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 8,
    fontFamily: "LexendDeca_500Medium",
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },
  submitButton: {
    backgroundColor: "#FF8447",
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 30,
    alignItems: "center",
    width: 200,
    alignSelf: "center",
  },
  submitText: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "LexendDeca_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    width: 300,
    height: 400,
    elevation: 10,
    justifyContent: "center",
  },
  gif: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FF5722",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#555555",
    textAlign: "center",
    marginTop: 10,
  },
  backButton: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default BDMReportScreen;