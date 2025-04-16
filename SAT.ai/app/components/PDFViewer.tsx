// import React, { useState, useEffect } from 'react';
// import { View, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
// import Pdf from 'react-native-pdf';
// import { MaterialIcons } from '@expo/vector-icons';
// import { storage } from '@/firebaseConfig';
// import { ref, getDownloadURL } from 'firebase/storage';

// interface PDFViewerProps {
//   onClose: () => void;
//   pdfPath: string;
// }

// const PDFViewer: React.FC<PDFViewerProps> = ({ onClose, pdfPath }) => {
//   const [pdfUrl, setPdfUrl] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const loadPdf = async () => {
//       try {
//         setIsLoading(true);
//         const pdfRef = ref(storage, pdfPath);
//         const url = await getDownloadURL(pdfRef);
//         setPdfUrl(url);
//       } catch (err) {
//         console.error('Error loading PDF:', err);
//         setError('Failed to load PDF. Please try again later.');
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     loadPdf();
//   }, [pdfPath]);

//   if (isLoading) {
//     return (
//       <View style={styles.container}>
//         <ActivityIndicator size="large" color="#FF8447" />
//         <Text style={styles.loadingText}>Loading PDF...</Text>
//       </View>
//     );
//   }

//   if (error) {
//     return (
//       <View style={styles.container}>
//         <Text style={styles.errorText}>{error}</Text>
//         <TouchableOpacity onPress={onClose} style={styles.closeButton}>
//           <Text style={styles.closeButtonText}>Close</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <TouchableOpacity onPress={onClose} style={styles.backButton}>
//         <MaterialIcons name="arrow-back" size={24} color="#333" />
//         <Text style={styles.backButtonText}>Back</Text>
//       </TouchableOpacity>
      
//       {pdfUrl && (
//         <Pdf
//           source={{ uri: pdfUrl }}
//           style={styles.pdf}
//           onLoadComplete={(numberOfPages: number) => {
//             console.log(`PDF loaded with ${numberOfPages} pages`);
//           }}
//           onPageChanged={(page: number) => {
//             console.log(`Current page: ${page}`);
//           }}
//           onError={(error: Error) => {
//             console.error('PDF Error:', error);
//             setError('Error displaying PDF');
//           }}
//         />
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   pdf: {
//     flex: 1,
//     width: Dimensions.get('window').width,
//     height: Dimensions.get('window').height,
//   },
//   backButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 16,
//     backgroundColor: '#FFFFFF',
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 2,
//   },
//   backButtonText: {
//     marginLeft: 8,
//     fontSize: 16,
//     fontFamily: 'LexendDeca_500Medium',
//     color: '#333',
//   },
//   loadingText: {
//     marginTop: 16,
//     fontSize: 16,
//     fontFamily: 'LexendDeca_400Regular',
//     color: '#666',
//     textAlign: 'center',
//   },
//   errorText: {
//     fontSize: 16,
//     fontFamily: 'LexendDeca_400Regular',
//     color: '#FF3B30',
//     textAlign: 'center',
//     marginTop: 16,
//     paddingHorizontal: 24,
//   },
//   closeButton: {
//     marginTop: 16,
//     padding: 12,
//     backgroundColor: '#FF8447',
//     borderRadius: 8,
//     alignSelf: 'center',
//   },
//   closeButtonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontFamily: 'LexendDeca_500Medium',
//   },
// });

// export default PDFViewer; 