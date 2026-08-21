import { useLocationStore } from '../src/stores/location.store';

describe('location.store — extended', () => {
  beforeEach(() => {
    useLocationStore.getState().reset();
  });

  it('starts with empty location and no tracking', () => {
    const state = useLocationStore.getState();
    expect(state.latitude).toBeNull();
    expect(state.longitude).toBeNull();
    expect(state.isTracking).toBe(false);
    expect(state.warning).toBeNull();
    expect(state.lastUpdated).toBeNull();
  });

  it('sets partial location fields', () => {
    useLocationStore.getState().setLocation({
      latitude: 30.0444,
      longitude: 31.2357,
      accuracy: 10,
      heading: 90,
      speed: 5,
      altitude: 100,
    });
    const state = useLocationStore.getState();
    expect(state.latitude).toBe(30.0444);
    expect(state.longitude).toBe(31.2357);
    expect(state.accuracy).toBe(10);
    expect(state.heading).toBe(90);
    expect(state.speed).toBe(5);
    expect(state.altitude).toBe(100);
    expect(state.isTracking).toBe(false);
    expect(state.lastUpdated).toBeGreaterThan(0);
  });

  it('sets and clears warning message', () => {
    useLocationStore.getState().setWarning('Location permission denied');
    expect(useLocationStore.getState().warning).toBe('Location permission denied');

    useLocationStore.getState().setWarning(null);
    expect(useLocationStore.getState().warning).toBeNull();
  });

  it('tracks location state independently', () => {
    useLocationStore.getState().setLocation({ latitude: 30, longitude: 31 });
    useLocationStore.getState().startTracking();
    expect(useLocationStore.getState().isTracking).toBe(true);

    useLocationStore.getState().stopTracking();
    expect(useLocationStore.getState().isTracking).toBe(false);
    expect(useLocationStore.getState().latitude).toBe(30);
  });

  it('reset clears all location state including warnings', () => {
    useLocationStore.getState().setLocation({ latitude: 30, longitude: 31 });
    useLocationStore.getState().setWarning('test warning');
    useLocationStore.getState().startTracking();

    useLocationStore.getState().reset();

    const state = useLocationStore.getState();
    expect(state.latitude).toBeNull();
    expect(state.longitude).toBeNull();
    expect(state.warning).toBeNull();
    expect(state.isTracking).toBe(false);
    expect(state.lastUpdated).toBeNull();
  });
});
