import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore, type AuthUser, type DriverProfile } from '@/stores/auth.store';
import { type AvailableOrder, type ActiveDelivery, type DeliveryHistoryItem, type DeliveryStatus } from '@/stores/orders.store';

// Read base URL from Expo public env or constants
const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  try {
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    const url = extra.apiUrl;
    if (!url) throw new Error('Missing apiUrl in app.json extra');
    return url;
  } catch (e) {
    throw new Error(`API base URL is not configured: ${e}`);
  }
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach JWT ────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — log out
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

type ApiEnvelope<T> = { success: boolean; data: T; error: unknown };

function unwrap<T>(payload: T | ApiEnvelope<T>): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export const apiGet = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<T | ApiEnvelope<T>>(url, { params }).then((r) => unwrap(r.data));

export const apiPost = <T>(url: string, data?: unknown) =>
  api.post<T | ApiEnvelope<T>>(url, data).then((r) => unwrap(r.data));

export const apiPatch = <T>(url: string, data?: unknown) =>
  api.patch<T | ApiEnvelope<T>>(url, data).then((r) => unwrap(r.data));

export const apiDelete = <T>(url: string) =>
  api.delete<T | ApiEnvelope<T>>(url).then((r) => unwrap(r.data));

// ─── Driver-specific API calls ────────────────────────────────────────────────

export const driverApi = {
  // Auth
  login: (data: { identifier: string; password: string }) =>
    api.post<{ success: boolean; data: { token: string; user: AuthUser } }>('/driver/login', data)
      .then((r) => r.data.data),

  register: (data: { fullName: string; email: string; phone: string; password: string; vehicleType: string; vehiclePlate: string; vehicleModel: string; vehicleColor: string }) =>
    api.post<{ success: boolean; data: { token: string; user: AuthUser } }>('/driver/register', data)
      .then((r) => r.data.data),

  // Profile
  getProfile: () => apiGet<{ driverProfile: DriverProfile }>('/driver/profile'),
  updateProfile: (data: Partial<{ id: string; fullName: string; email?: string; phone?: string; vehicleType?: string; vehiclePlate?: string; vehicleModel?: string; vehicleColor?: string }>) =>
    apiPatch<DriverProfile>('/driver/profile', data),
  getStatistics: () => apiGet<{ totalDeliveries: number; completionRate: string; totalEarnings: string; rating: string; today: { earnings: string; deliveries: number }; thisWeek: { earnings: string; deliveries: number }; thisMonth: { earnings: string; deliveries: number } }>('/driver/statistics'),

  // Status
  goOnline: () => apiPost<{ success: boolean; isOnline: boolean }>('/driver/status/online'),
  goOffline: () => apiPost<{ success: boolean; isOnline: boolean }>('/driver/status/offline'),

  // Location
  updateLocation: (data: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    altitude?: number;
    timestamp?: number;
  }) => apiPost<{ success: boolean }>('/driver/location', data),

  // Orders
  getAvailableOrders: () => apiGet<AvailableOrder[]>('/driver/orders/available'),
  getActiveDelivery: () => apiGet<ActiveDelivery | null>('/driver/orders/active'),
  getDeliveryHistory: (page = 1, limit = 20) =>
    apiGet<DeliveryHistoryItem[]>('/driver/orders/history', { page, limit }),

  acceptOrder: (orderId: string, data?: { assignmentId?: string }) =>
    apiPost<ActiveDelivery>(`/driver/orders/${orderId}/accept`, data ?? {}),

  rejectOrder: (orderId: string, reason?: string) =>
    apiPost<{ success: boolean }>(`/driver/orders/${orderId}/reject`, { reason }),

  enRouteToPickup: (orderId: string) =>
    apiPost<{ success: boolean }>(`/driver/orders/${orderId}/en-route-pickup`),

  arrivedPharmacy: (orderId: string, currentLat: number, currentLng: number) =>
    apiPost<{ success: boolean }>(`/driver/orders/${orderId}/arrived-pharmacy`, { currentLat, currentLng }),

  pickedUp: (orderId: string, notes?: string) =>
    apiPost<{ success: boolean }>(`/driver/orders/${orderId}/picked-up`, { notes }),

  enRouteToCustomer: (orderId: string) =>
    apiPost<{ success: boolean }>(`/driver/orders/${orderId}/en-route-customer`),

  arrivedCustomer: (orderId: string, currentLat: number, currentLng: number) =>
    apiPost<{ success: boolean }>(`/driver/orders/${orderId}/arrived-customer`, { currentLat, currentLng }),
  completeDelivery: (orderId: string, data: {
    proofPhotoUrl?: string;
    customerSignature?: string;
    deliveryNotes?: string;
    customerRating?: number;
    customerFeedback?: string;
  }) => apiPost<{ success: boolean }>(`/driver/orders/${orderId}/complete`, data),

  // Documents
  uploadDocument: async (type: 'license' | 'id' | 'vehicle' | 'insurance', uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'document.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type: mimeType } as unknown as Parameters<FormData['append']>[1]);

    const token = useAuthStore.getState().token;
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/driver/documents/upload/${type}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const payload = await response.json();
    return payload.data ?? payload;
  },

  // Notifications
  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    apiPost<{ success: boolean }>('/notifications/token', { token, platform }),
};
