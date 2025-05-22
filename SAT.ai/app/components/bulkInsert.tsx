import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { Button, Text } from "react-native-paper";

const BulkInsert = () => {
  const [filename, setFilename] = useState("");

  const handleExcelUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFilename(file.name);

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (!jsonData.length) {
          Alert.alert("Error", "Excel file is empty or invalid.");
          return;
        }

        const insertions = jsonData.map((q: any) =>
          addDoc(collection(db, "questions"), {
            dept_id: q.dept_id,
            question: q.question,
            question_id: q.question_id,
            title_id: q.title_id,
          })
        );

        await Promise.all(insertions);
        console.log("✅ All questions inserted");
        Alert.alert("Success", "All questions inserted successfully");
      };

      reader.readAsBinaryString(blob);
    } catch (error) {
      console.error("❌ Upload error:", error);
      Alert.alert("Error", "Something went wrong while uploading");
    }
  };

  return (
    <View style={styles.container}>
      <Button mode="contained" onPress={handleExcelUpload}>
        Upload Excel & Insert Questions
      </Button>
      {filename ? <Text style={styles.filename}>📁 {filename}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  filename: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
  },
});

export default BulkInsert;
