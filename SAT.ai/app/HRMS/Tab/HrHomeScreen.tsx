import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, Linking } from 'react-native';
import HrMainLayout from '@/app/components/HrMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { db } from '@/firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';

const HrHomeScreen = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const q = query(collection(db, 'leave_applications'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const results: any[] = [];

        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });

        setApplications(results);
      } catch (error) {
        console.error('Error fetching leave applications:', error);
      }
    };

    fetchApplications();
  }, []);

  const openModal = (application: any) => {
    setSelectedApplication(application);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedApplication(null);
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const ref = doc(db, 'leave_applications', selectedApplication.id);

      await updateDoc(ref, { status: newStatus });

      setApplications((prev) =>
        prev.map((app) =>
          app.id === selectedApplication.id ? { ...app, status: newStatus } : app
        )
      );

      closeModal();
    } catch (error) {
      console.error('Status update failed:', error);
      alert('Failed to update status, please try again.');
    }
  };

  return (
    <AppGradient>
      <HrMainLayout showDrawer showBottomTabs={false} showBackButton={false}>
        <ScrollView horizontal>
          <View style={styles.table}>
            <View style={styles.row}>
              {['Name', 'Leave Type', 'Applied On', 'Start Date', 'End Date', 'Reason', 'Duration', 'Status', 'Action'].map((header, i) => (
                <View key={i} style={styles.cellWrapper}><Text style={styles.headerText}>{header}</Text></View>
              ))}
            </View>

            {applications.map((data, index) => (
              <View style={styles.row} key={index}>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{data.name || '-'}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{data.leaveType || '-'}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{new Date(data.createdAt?.seconds * 1000).toLocaleDateString()}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{new Date(data.fromDate?.seconds * 1000).toLocaleDateString()}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{new Date(data.toDate?.seconds * 1000).toLocaleDateString()}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{data.reason || '-'}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{data.duration || '-'}</Text></View>
                <View style={styles.cellWrapper}><Text style={styles.cellText}>{data.status || '-'}</Text></View>
                <View style={styles.cellWrapper}>
                  <TouchableOpacity onPress={() => openModal(data)}>
                    <Text style={[styles.cellText, { color: '#007BFF', textDecorationLine: 'underline' }]}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {selectedApplication && (
  <Modal
    visible={isModalVisible}
    animationType="slide"
    transparent={true}
    onRequestClose={closeModal}
  >
    <View style={styles.modalOverlay}>
      <ScrollView
        style={styles.modalScrollView}
        contentContainerStyle={styles.modalContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.modalTitle}>Leave Application Details</Text>

        {/* Static Labels with Dynamic Values */}
        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Name</Text>
          <Text style={styles.modalValue}>{selectedApplication.name || '-'}</Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Leave Type</Text>
          <Text style={styles.modalValue}>{selectedApplication.leaveType || '-'}</Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Applied On</Text>
          <Text style={styles.modalValue}>
            {new Date(selectedApplication.createdAt?.seconds * 1000).toLocaleString() || '-'}
          </Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Start Date</Text>
          <Text style={styles.modalValue}>
            {new Date(selectedApplication.fromDate?.seconds * 1000).toLocaleDateString() || '-'}
          </Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>End Date</Text>
          <Text style={styles.modalValue}>
            {new Date(selectedApplication.toDate?.seconds * 1000).toLocaleDateString() || '-'}
          </Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Reason</Text>
          <Text style={styles.modalValue}>{selectedApplication.reason || '-'}</Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Duration</Text>
          <Text style={styles.modalValue}>{selectedApplication.duration || '-'}</Text>
        </View>

        <View style={styles.modalRow}>
          <Text style={styles.modalLabel}>Status</Text>
          <Text style={styles.modalValue}>{selectedApplication.status || '-'}</Text>
        </View>

        {/* File URL and Preview */}
        {selectedApplication.uploadedFileURL && (
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Uploaded File</Text>
            <TouchableOpacity onPress={() => Linking.openURL(selectedApplication.uploadedFileURL)}>
              <Text style={styles.previewLink}>Open in browser</Text>
            </TouchableOpacity>
            <View style={styles.filePreviewBox}>
              <Text style={styles.previewLabel}>Preview:</Text>
              {selectedApplication.uploadedFileURL?.includes('.pdf') ? (
                <Text style={styles.pdfNote}>PDF Preview Not Available</Text>
              ) : (
                <Image source={{ uri: selectedApplication.uploadedFileURL }} style={styles.previewImage} />
              )}
            </View>
          </View>
        )}

        {/* Approve/Reject Buttons */}
        <View style={styles.statusButtonContainer}>
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: 'green' }]}
            onPress={() => updateStatus('approved')}
          >
            <Text style={styles.statusButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: 'red' }]}
            onPress={() => updateStatus('rejected')}
          >
            <Text style={styles.statusButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  </Modal>
)}

      </HrMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  table: {
    margin: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    minWidth: 1200
  },
  row: {
    flexDirection: 'row'
  },
  cellWrapper: {
    width: 160,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: 'white',
    backgroundColor: '#FF8447',
    width: '100%',
    textAlign: 'center',
    paddingVertical: 6
  },
  cellText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalScrollView: {
    width: '90%',
    maxHeight: '90%',
    backgroundColor: 'white',
    borderRadius: 10
  },
  modalContent: {
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  modalRow: {
    marginBottom: 10
  },
  modalLabel: {
    fontWeight: '600',
    fontSize: 13,
    color: '#333'
  },
  modalValue: {
    fontSize: 14,
    color: '#000'
  },
  previewLink: {
    color: '#007BFF',
    textDecorationLine: 'underline',
    marginBottom: 6
  },
  filePreviewBox: {
    alignItems: 'center',
    marginVertical: 10
  },
  previewLabel: {
    fontWeight: 'bold',
    marginBottom: 5
  },
  previewImage: {
    width: 250,
    height: 150,
    borderRadius: 6
  },
  pdfNote: {
    color: '#888',
    fontStyle: 'italic'
  },
  statusButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6
  },
  statusButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: '#004080',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center'
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold'
  }
});

export default HrHomeScreen;
