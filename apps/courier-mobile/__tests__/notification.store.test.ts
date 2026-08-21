import { useNotificationStore, type AppNotification } from '../src/stores/notification.store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('notification.store', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it('starts with empty notifications', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(0);
    expect(state.unreadCount).toBe(0);
    expect(state.pushToken).toBeNull();
  });

  it('adds notification and increments unread count', () => {
    useNotificationStore.getState().addNotification({
      id: '1',
      title: 'New Order',
      body: 'You have a new delivery',
    });
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].title).toBe('New Order');
    expect(state.notifications[0].isRead).toBe(false);
    expect(state.unreadCount).toBe(1);
  });

  it('marks single notification as read', () => {
    useNotificationStore.getState().addNotification({
      id: '1',
      title: 'Order 1',
      body: 'Body 1',
    });
    useNotificationStore.getState().addNotification({
      id: '2',
      title: 'Order 2',
      body: 'Body 2',
    });
    expect(useNotificationStore.getState().unreadCount).toBe(2);

    useNotificationStore.getState().markRead('1');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
    const marked = useNotificationStore.getState().notifications.find((n) => n.id === '1');
    expect(marked?.isRead).toBe(true);
    const unmarked = useNotificationStore.getState().notifications.find((n) => n.id === '2');
    expect(unmarked?.isRead).toBe(false);
  });

  it('marks all notifications as read', () => {
    useNotificationStore.getState().addNotification({ id: '1', title: 'T1', body: 'B1' });
    useNotificationStore.getState().addNotification({ id: '2', title: 'T2', body: 'B2' });
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications.every((n) => n.isRead)).toBe(true);
  });

  it('clears all notifications', () => {
    useNotificationStore.getState().addNotification({ id: '1', title: 'T', body: 'B' });
    useNotificationStore.getState().addNotification({ id: '2', title: 'T2', body: 'B2' });
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('allows duplicate notifications', () => {
    useNotificationStore.getState().addNotification({ id: '1', title: 'T', body: 'B' });
    useNotificationStore.getState().addNotification({ id: '1', title: 'T', body: 'B' });
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
  });

  it('keeps only last 100 notifications', () => {
    for (let i = 0; i < 105; i++) {
      useNotificationStore.getState().addNotification({ id: `n${i}`, title: `T${i}`, body: `B${i}` });
    }
    expect(useNotificationStore.getState().notifications).toHaveLength(100);
  });

  it('sets and stores push token', () => {
    useNotificationStore.getState().setToken('push-token-123');
    expect(useNotificationStore.getState().pushToken).toBe('push-token-123');
  });
});
