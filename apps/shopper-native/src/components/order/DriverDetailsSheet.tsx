/**
 * Driver Details Bottom Sheet Component
 * 
 * A bottom sheet that displays detailed driver information including:
 * - Driver name, photo, and phone number
 * - Estimated arrival time (ETA)
 * - Order status
 * - Rating (optional)
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

const { width } = Dimensions.get('window');

interface DriverDetailsSheetProps {
  /** Whether the sheet is visible */
  isVisible: boolean;
  /** Close sheet callback */
  onClose: () => void;
  /** Driver name */
  driverName?: string;
  /** Driver phone number */
  driverPhone?: string;
  /** Driver photo URL */
  driverPhoto?: string;
  /** Driver rating (out of 5) */
  driverRating?: number;
  /** Estimated arrival in minutes */
  estimatedArrival?: number;
  /** Current order status */
  orderStatus?: 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  /** Driver license plate (optional) */
  licensePlate?: string;
  /** Driver vehicle model (optional) */
  vehicleModel?: string;
}

export const DriverDetailsSheet: React.FC<DriverDetailsSheetProps> = ({
  isVisible,
  onClose,
  driverName = 'السائق',
  driverPhone,
  driverPhoto,
  driverRating = 4.5,
  estimatedArrival = 10,
  orderStatus = 'pending',
  licensePlate,
  vehicleModel = 'سيارة',
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Snap points: 0% (closed), 50%, 80%
  const snapPoints = ['0%', '50%', '80%'];

  // Handle sheet visibility
  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible]);

  // Handle phone call
  const handleCallPress = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    }
  };

  // Handle WhatsApp
  const handleWhatsAppPress = () => {
    if (driverPhone) {
      const url = `whatsapp://send?phone=${driverPhone}`;
      Linking.openURL(url).catch(() => {
        // Fallback to web WhatsApp
        Linking.openURL(`https://wa.me/${driverPhone}`);
      });
    }
  };

  // Render backdrop
  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={0}
      appearsOnIndex={1}
      opacity={0.5}
      pressBehavior="close"
    />
  );

  // Get status info
  const getStatusInfo = () => {
    const statusMap = {
      pending: { 
        text: 'في انتظار السائق', 
        color: '#F59E0B', 
        icon: 'time-outline',
        emoji: '⏳'
      },
      accepted: { 
        text: 'تم قبول الطلب', 
        color: '#3B82F6', 
        icon: 'checkmark-circle-outline',
        emoji: '✅'
      },
      picked_up: { 
        text: 'في الطريق إليك', 
        color: '#8B5CF6', 
        icon: 'car-outline',
        emoji: '🚚'
      },
      delivered: { 
        text: 'تم التوصيل', 
        color: '#10B981', 
        icon: 'checkmark-done-circle-outline',
        emoji: '🎉'
      },
      cancelled: { 
        text: 'تم الإلغاء', 
        color: '#EF4444', 
        icon: 'close-circle-outline',
        emoji: '❌'
      },
    };
    return statusMap[orderStatus] || statusMap.pending;
  };

  const statusInfo = getStatusInfo();

  // Render stars for rating
  const renderRating = () => {
    const stars = [];
    const fullStars = Math.floor(driverRating);
    const hasHalfStar = driverRating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Ionicons key={i} name="star" size={16} color="#F59E0B" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Ionicons key={i} name="star-half" size={16} color="#F59E0B" />
        );
      } else {
        stars.push(
          <Ionicons key={i} name="star-outline" size={16} color="#D1D5DB" />
        );
      }
    }
    return stars;
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={isVisible ? 1 : 0}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={onClose}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>تفاصيل السائق</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Driver Info */}
        <View style={styles.driverInfo}>
          <View style={styles.avatarContainer}>
            {driverPhoto ? (
              <Image source={{ uri: driverPhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#FFFFFF" />
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <Text style={styles.statusBadgeText}>{statusInfo.emoji}</Text>
            </View>
          </View>

          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverName}</Text>
            <View style={styles.ratingContainer}>
              {renderRating()}
              <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
            </View>
            <View style={styles.statusContainer}>
              <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.text}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle Info */}
        {(licensePlate || vehicleModel) && (
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleInfoRow}>
              <Ionicons name="car-outline" size={20} color="#6B7280" />
              <Text style={styles.vehicleInfoLabel}>المركبة:</Text>
              <Text style={styles.vehicleInfoValue}>
                {vehicleModel} {licensePlate ? `- ${licensePlate}` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* ETA */}
        {orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <View style={styles.etaContainer}>
            <View style={styles.etaIconContainer}>
              <Ionicons name="time-outline" size={28} color="#8B5CF6" />
            </View>
            <View style={styles.etaTextContainer}>
              <Text style={styles.etaLabel}>الوقت المتوقع للوصول</Text>
              <Text style={styles.etaValue}>{estimatedArrival} دقيقة</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.callButton]} 
            onPress={handleCallPress}
            disabled={!driverPhone}
          >
            <Ionicons name="call-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>اتصال</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.whatsappButton]} 
            onPress={handleWhatsAppPress}
            disabled={!driverPhone}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>واتساب</Text>
          </TouchableOpacity>
        </View>

        {/* Note */}
        <Text style={styles.note}>
          يمكنك التواصل مع السائق مباشرة عبر الاتصال أو واتساب
        </Text>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#7C3AED',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusBadgeText: {
    fontSize: 14,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleInfo: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  vehicleInfoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  etaIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  etaTextContainer: {
    flex: 1,
  },
  etaLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  etaValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  callButton: {
    backgroundColor: '#3B82F6',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
});

export default DriverDetailsSheet;