/**
 * Shared Google Maps custom style arrays for dark/light mode, used by both
 * the live tracking map (map.tsx) and the active-delivery map (delivery.tsx)
 * so the two screens' map appearance never drifts apart.
 */

export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

export const LIGHT_MAP_STYLE = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cce4f0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { featureType: 'landscape.man_made', stylers: [{ color: '#f1f5f9' }] },
];
