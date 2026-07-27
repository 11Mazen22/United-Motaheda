import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

// Read base URL from Expo public env or constants
const getBaseUrl = (): string => {
  // EXPO_PUBLIC_ vars are inlined at build time by Metro
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    return extra.apiUrl ?? 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
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

export const apiGet = <T>(url: string, params?: Record<string, any>) =>
  api.get<T>(url, { params }).then((r) => r.data);

export const apiPost = <T>(url: string, data?: any) =>
  api.post<T>(url, data).then((r) => r.data);

export const apiPatch = <T>(url: string, data?: any) =>
  api.patch<T>(url, data).then((r) => r.data);

export const apiDelete = <T>(url: string) =>
  api.delete<T>(url).then((r) => r.data);

// ─── Driver-specific API calls ────────────────────────────────────────────────

export const driverApi = {
  // Auth
  login: (data: { identifier: string; password: string }) =>
    apiPost<{ token: string; user: any }>('/driver/login', data),

  register: (data: any) =>
    apiPost<{ token: string; user: any }>('/driver/register', data),

  // Profile
  getProfile: () => apiGet<any>('/driver/profile'),
  updateProfile: (data: any) => apiPatch<any>('/driver/profile', data),
  getStatistics: () => apiGet<any>('/driver/statistics'),

  // Status
  goOnline: () => apiPost<any>('/driver/status/online'),
  goOffline: () => apiPost<any>('/driver/status/offline'),

  // Location
  updateLocation: (data: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    altitude?: number;
    timestamp?: number;
  }) => apiPost<any>('/driver/location', data),

  // Orders
  getAvailableOrders: () => apiGet<any>('/driver/orders/available'),
  getActiveDelivery: () => apiGet<any>('/driver/orders/active'),
  getDeliveryHistory: (page = 1, limit = 20) =>
    apiGet<any>('/driver/orders/history', { page, limit }),

  acceptOrder: (orderId: string, data?: any) =>
    apiPost<any>(`/driver/orders/${orderId}/accept`, data ?? {}),
  rejectOrder: (orderId: string, reason?: string) =>
    apiPost<any>(`/driver/orders/${orderId}/reject`, { reason }),

  enRouteToPickup: (orderId: string) =>
    apiPost<any>(`/driver/orders/${orderId}/en-route-pickup`),
  arrivedPharmacy: (orderId: string, currentLat: number, currentLng: number) =>
    apiPost<any>(`/driver/orders/${orderId}/arrived-pharmacy`, { currentLat, currentLng }),
  pickedUp: (orderId: string, notes?: string) =>
    apiPost<any>(`/driver/orders/${orderId}/picked-up`, { notes }),
  enRouteToCustomer: (orderId: string) =>
    apiPost<any>(`/driver/orders/${orderId}/en-route-customer`),
  arrivedCustomer: (orderId: string, currentLat: number, currentLng: number) =>
    apiPost<any>(`/driver/orders/${orderId}/arrived-customer`, { currentLat, currentLng }),
  completeDelivery: (orderId: string, data: {
    proofPhotoUrl?: string;
    customerSignature?: string;
    deliveryNotes?: string;
    customerRating?: number;
    customerFeedback?: string;
  }) => apiPost<any>(`/driver/orders/${orderId}/complete`, data),

  // Documents
  uploadDocument: async (type: 'license' | 'id' | 'vehicle' | 'insurance', uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'document.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type: mimeType } as any);

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
    return response.json();
  },

  // Notifications
  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    apiPost<any>('/notifications/token/register', { token, platform }),
};
