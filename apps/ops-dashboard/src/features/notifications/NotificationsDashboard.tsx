/**
 * Notifications Dashboard
 * 
 * Professional UI for Admins to:
 * - Select Audience (Drivers, Customers, Pharmacists)
 * - Draft templates and Preview
 * - Check delivery logs and queue health metrics
 * - Send manual blasts
 * - View analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth';
import { api } from '@/lib/api';

// Types
interface Template {
  id: string;
  type: string;
  name: string;
  body_template: string;
  locale: string;
  is_active: boolean;
}

interface MetricData {
  totalSent: number;
  totalDelivered: number;
  deliveryRate: number;
  failed: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  dailyTrend: Array<{ date: string; sent: number }>;
}

interface BatchStatus {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}

export default function NotificationsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'metrics'>('send');

  // Send state
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedAudience, setSelectedAudience] = useState<'customers' | 'drivers' | 'pharmacists' | 'all'>('all');
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customData, setCustomData] = useState('');
  const [channels, setChannels] = useState({
    push: true,
    in_app: true,
    email: false,
    sms: false,
  });
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [previewData, setPreviewData] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sending, setSending] = useState(false);

  // History state
  const [batches, setBatches] = useState<BatchStatus[]>([]);
  const [historyPage, setHistoryPage] = useState(1);

  // Metrics state
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [metricsPeriod, setMetricsPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTemplates(),
        loadBatches(),
        loadMetrics(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('خطأ', 'فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.get('/admin/notifications/templates');
      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadBatches = async () => {
    try {
      const response = await api.get(`/admin/notifications/history?page=${historyPage}&limit=20`);
      if (response.data.success) {
        setBatches(response.data.data.batches || []);
      }
    } catch (error) {
      console.error('Failed to load batches:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await api.get('/admin/notifications/metrics');
      if (response.data.success) {
        setMetrics(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleSendBlast = async () => {
    if (!selectedType) {
      Alert.alert('تنبيه', 'يرجى اختيار نوع الإشعار');
      return;
    }

    if (!customTitle || !customBody) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان ونص الإشعار');
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/admin/notifications/send', {
        type: selectedType,
        title: customTitle,
        body: customBody,
        data: customData ? JSON.parse(customData) : {},
        channels: Object.keys(channels).filter(k => channels[k as keyof typeof channels]),
        priority,
        targeting: {
          userType: selectedAudience,
        },
      });

      if (response.data.success) {
        Alert.alert('نجاح', `تم إرسال الإشعار بنجاح إلى ${response.data.totalRecipients} مستخدم`);
        // Reset form
        setCustomTitle('');
        setCustomBody('');
        setCustomData('');
        // Refresh history
        loadBatches();
      } else {
        Alert.alert('خطأ', response.data.message || 'فشل في إرسال الإشعار');
      }
    } catch (error) {
      console.error('Failed to send blast:', error);
      Alert.alert('خطأ', 'فشل في إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedType) {
      Alert.alert('تنبيه', 'يرجى اختيار نوع الإشعار');
      return;
    }

    try {
      const data = customData ? JSON.parse(customData) : { userName: 'عميل' };
      const response = await api.post('/admin/notifications/preview', {
        type: selectedType,
        data: {
          ...data,
          customTitle,
          customBody,
        },
        locale: 'ar',
      });

      if (response.data.success) {
        setPreviewData(response.data.data);
        Alert.alert('معاينة الإشعار', `${response.data.data.title}\n\n${response.data.data.body}`);
      } else {
        Alert.alert('خطأ', response.data.message || 'فشل في معاينة الإشعار');
      }
    } catch (error) {
      console.error('Failed to preview:', error);
      Alert.alert('خطأ', 'فشل في معاينة الإشعار');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'processing': return '#3B82F6';
      case 'completed': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'processing': return 'جاري الإرسال';
      case 'completed': return 'مكتمل';
      case 'failed': return 'فشل';
      default: return status;
    }
  };

  // ============================================================
  // Render: Send Tab
  // ============================================================
  const renderSendTab = () => (
    <View style={styles.tabContent}>
      {/* Template Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>نوع الإشعار</Text>
        <View style={styles.templateGrid}>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateChip,
                selectedType === template.type && styles.templateChipActive,
              ]}
              onPress={() => setSelectedType(template.type)}
            >
              <Text style={[
                styles.templateChipText,
                selectedType === template.type && styles.templateChipTextActive,
              ]}>
                {template.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Audience Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الجمهور المستهدف</Text>
        <View style={styles.audienceRow}>
          {['all', 'customers', 'drivers', 'pharmacists'].map((audience) => (
            <TouchableOpacity
              key={audience}
              style={[
                styles.audienceChip,
                selectedAudience === audience && styles.audienceChipActive,
              ]}
              onPress={() => setSelectedAudience(audience as any)}
            >
              <Text style={[
                styles.audienceChipText,
                selectedAudience === audience && styles.audienceChipTextActive,
              ]}>
                {audience === 'all' && 'الكل'}
                {audience === 'customers' && 'عملاء'}
                {audience === 'drivers' && 'سائقين'}
                {audience === 'pharmacists' && 'صيادلة'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>محتوى الإشعار</Text>
        <TextInput
          style={styles.input}
          placeholder="العنوان"
          value={customTitle}
          onChangeText={setCustomTitle}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="النص"
          value={customBody}
          onChangeText={setCustomBody}
          multiline
          numberOfLines={4}
        />
        <TextInput
          style={styles.input}
          placeholder="بيانات إضافية (JSON)"
          value={customData}
          onChangeText={setCustomData}
        />
      </View>

      {/* Channels */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>قنوات الإرسال</Text>
        <View style={styles.channelsRow}>
          <View style={styles.channelItem}>
            <Text>Push</Text>
            <Switch
              value={channels.push}
              onValueChange={(v) => setChannels({ ...channels, push: v })}
            />
          </View>
          <View style={styles.channelItem}>
            <Text>In-App</Text>
            <Switch
              value={channels.in_app}
              onValueChange={(v) => setChannels({ ...channels, in_app: v })}
            />
          </View>
          <View style={styles.channelItem}>
            <Text>Email</Text>
            <Switch
              value={channels.email}
              onValueChange={(v) => setChannels({ ...channels, email: v })}
            />
          </View>
          <View style={styles.channelItem}>
            <Text>SMS</Text>
            <Switch
              value={channels.sms}
              onValueChange={(v) => setChannels({ ...channels, sms: v })}
            />
          </View>
        </View>
      </View>

      {/* Priority */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الأولوية</Text>
        <View style={styles.priorityRow}>
          {['high', 'normal', 'low'].map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityChip,
                priority === p && styles.priorityChipActive,
              ]}
              onPress={() => setPriority(p as any)}
            >
              <Text style={[
                styles.priorityChipText,
                priority === p && styles.priorityChipTextActive,
              ]}>
                {p === 'high' && 'عالية'}
                {p === 'normal' && 'متوسطة'}
                {p === 'low' && 'منخفضة'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.previewButton} onPress={handlePreview}>
          <Ionicons name="eye-outline" size={20} color="#6B7280" />
          <Text style={styles.previewButtonText}>معاينة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSendBlast}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>إرسال</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ============================================================
  // Render: History Tab
  // ============================================================
  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      {batches.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>لا توجد حملات سابقة</Text>
          <Text style={styles.emptyStateSubtitle}>سيظهر تاريخ الإشعارات هنا</Text>
        </View>
      ) : (
        batches.map((batch) => (
          <View key={batch.id} style={styles.batchItem}>
            <View style={styles.batchHeader}>
              <Text style={styles.batchName}>{batch.name}</Text>
              <View style={[styles.batchStatus, { backgroundColor: getStatusColor(batch.status) }]}>
                <Text style={styles.batchStatusText}>{getStatusText(batch.status)}</Text>
              </View>
            </View>
            <View style={styles.batchStats}>
              <Text style={styles.batchStat}>إجمالي: {batch.total_recipients}</Text>
              <Text style={[styles.batchStat, { color: '#10B981' }]}>مرسل: {batch.sent_count}</Text>
              <Text style={[styles.batchStat, { color: '#EF4444' }]}>فشل: {batch.failed_count}</Text>
            </View>
            <Text style={styles.batchDate}>
              {new Date(batch.created_at).toLocaleDateString('ar-EG')}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  // ============================================================
  // Render: Metrics Tab
  // ============================================================
  const renderMetricsTab = () => (
    <View style={styles.tabContent}>
      {!metrics ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.emptyStateTitle}>جاري تحميل الإحصائيات...</Text>
        </View>
      ) : (
        <>
          {/* Summary Cards */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{metrics.totalSent.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>إجمالي مرسل</Text>
            </View>
            <View style={[styles.metricCard, { borderColor: '#10B981' }]}>
              <Text style={[styles.metricValue, { color: '#10B981' }]}>
                {metrics.deliveryRate}%
              </Text>
              <Text style={styles.metricLabel}>نسبة التوصيل</Text>
            </View>
            <View style={[styles.metricCard, { borderColor: '#EF4444' }]}>
              <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                {metrics.failed.toLocaleString()}
              </Text>
              <Text style={styles.metricLabel}>فشل</Text>
            </View>
          </View>

          {/* By Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>حسب النوع</Text>
            {Object.entries(metrics.byType).map(([type, count]) => (
              <View key={type} style={styles.statRow}>
                <Text style={styles.statLabel}>{type}</Text>
                <Text style={styles.statValue}>{count}</Text>
              </View>
            ))}
          </View>

          {/* By Channel */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>حسب القناة</Text>
            {Object.entries(metrics.byChannel).map(([channel, count]) => (
              <View key={channel} style={styles.statRow}>
                <Text style={styles.statLabel}>{channel}</Text>
                <Text style={styles.statValue}>{count}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  // ============================================================
  // Main Render
  // ============================================================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>جاري تحميل لوحة التحكم...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 لوحة تحكم الإشعارات</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['send', 'history', 'metrics'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'send' && '📨 إرسال'}
              {tab === 'history' && '📋 التاريخ'}
              {tab === 'metrics' && '📊 الإحصائيات'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'send' && renderSendTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'metrics' && renderMetricsTab()}
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#F5F3FF',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  templateChipActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  templateChipText: {
    fontSize: 13,
    color: '#6B7280',
  },
  templateChipTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  audienceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  audienceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  audienceChipActive: {
    backgroundColor: '#8B5CF6',
  },
  audienceChipText: {
    fontSize: 13,
    color: '#6B7280',
  },
  audienceChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  channelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  priorityChipActive: {
    backgroundColor: '#8B5CF6',
  },
  priorityChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  priorityChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
    gap: 8,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    flex: 2,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  batchItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  batchStatus: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  batchStatusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  batchStats: {
    flexDirection: 'row',
    gap: 16,
  },
  batchStat: {
    fontSize: 13,
    color: '#6B7280',
  },
  batchDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
});