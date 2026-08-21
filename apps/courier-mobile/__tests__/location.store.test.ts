import { useLocationStore } from '../src/stores/location.store';

describe('location.store', () => {
  beforeEach(() => {
    useLocationStore.getState().reset();
  });

  it('starts with empty location', () => {
    const state = useLocationStore.getState();
    expect(state.latitude).toBeNull();
    expect(state.longitude).toBeNull();
    expect(state.isTracking).toBe(false);
    expect(state.warning).toBeNull();
  });

  it('sets location', () => {
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
  });

  it('sets warning message', () => {
    useLocationStore.getState().setWarning('Location permission denied');
    expect(useLocationStore.getState().warning).toBe('Location permission denied');
  });

  it('tracks location state', () => {
    useLocationStore.getState().startTracking();
    expect(useLocationStore.getState().isTracking).toBe(true);

    useLocationStore.getState().stopTracking();
    expect(useLocationStore.getState().isTracking).toBe(false);
  });

  it('resets to initial state', () => {
    useLocationStore.getState().setLocation({ latitude: 30, longitude: 31 });
    useLocationStore.getState().setWarning('test warning');
    useLocationStore.getState().startTracking();

    useLocationStore.getState().reset();

    const state = useLocationStore.getState();
    expect(state.latitude).toBeNull();
    expect(state.longitude).toBeNull();
    expect(state.warning).toBeNull();
    expect(state.isTracking).toBe(false);
  });
});
