/**
 * html.ts — builds the static HTML/JS document that runs inside the
 * WebView, plus the small marker-icon templates used across the app's three
 * map screens. See LeafletMap.tsx for the RN-side half of this bridge.
 */
import type { MapRegion } from "./types";

/**
 * Full HTML document, parameterised only by the initial region/zoom and the
 * Geoapify tile URL. Everything else (markers, circles, polylines, camera
 * moves) is pushed in afterwards via `injectJavaScript` calls into the
 * global functions defined at the bottom of this document — see
 * LeafletMap.tsx's `run()` helper for the RN side of each call.
 *
 * Leaflet itself loads from a CDN rather than being bundled: it's a single
 * ~150KB request the device makes once per screen mount, no different in
 * kind from the tile requests the map needs anyway, and it avoids adding a
 * bundler asset step for a WebView-only dependency.
 */
export function buildMapHtml(initialRegion: MapRegion, tileUrl: string, zoomControl: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #eef1f4; }
  .leaflet-control-attribution { font-size: 9px; }
  .leaflet-marker-icon { transition: transform 120ms ease; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
window.onerror = function (message, source, lineno, colno, error) {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(message) + ' @' + lineno + ':' + colno }));
  } catch (e) {}
  return false;
};
(function () {
  var map = L.map('map', {
    zoomControl: ${JSON.stringify(zoomControl)},
    attributionControl: true,
  }).setView([${initialRegion.latitude}, ${initialRegion.longitude}], ${initialRegion.zoom});

  var tileLayer = L.tileLayer(${JSON.stringify(tileUrl)}, {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors, &copy; Geoapify',
  }).addTo(map);
  tileLayer.on('tileerror', function (e) {
    post({ type: 'error', message: 'tileerror: ' + (e && e.error && e.error.message ? e.error.message : 'unknown') });
  });
  tileLayer.on('load', function () {
    post({ type: 'error', message: 'tiles-loaded-ok' });
  });

  var markers = {};   // id -> L.Marker
  var circles = {};   // id -> L.Circle
  var polylineLayer = null;

  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  map.on('click', function (e) {
    post({ type: 'press', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  // ── Called from React Native ──────────────────────────────────────────
  window.__syncMarkers = function (specsJson) {
    var specs = JSON.parse(specsJson);
    var seen = {};
    specs.forEach(function (spec) {
      seen[spec.id] = true;
      var icon = L.divIcon({
        html: spec.html,
        className: '',
        iconSize: [spec.width, spec.height],
        iconAnchor: [spec.width * spec.anchorX, spec.height * spec.anchorY],
      });
      var existing = markers[spec.id];
      if (existing) {
        existing.setLatLng([spec.coordinate.latitude, spec.coordinate.longitude]);
        existing.setIcon(icon);
        existing.setZIndexOffset(spec.zIndexOffset || 0);
      } else {
        var m = L.marker([spec.coordinate.latitude, spec.coordinate.longitude], {
          icon: icon,
          draggable: !!spec.draggable,
          zIndexOffset: spec.zIndexOffset || 0,
        }).addTo(map);
        m.on('click', function () { post({ type: 'markerPress', id: spec.id }); });
        m.on('dragend', function (e) {
          var ll = e.target.getLatLng();
          post({ type: 'markerDragEnd', id: spec.id, lat: ll.lat, lng: ll.lng });
        });
        markers[spec.id] = m;
      }
    });
    Object.keys(markers).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(markers[id]); delete markers[id]; }
    });
  };

  window.__syncCircles = function (specsJson) {
    var specs = JSON.parse(specsJson);
    var seen = {};
    specs.forEach(function (spec) {
      seen[spec.id] = true;
      var existing = circles[spec.id];
      if (existing) {
        existing.setLatLng([spec.center.latitude, spec.center.longitude]);
        existing.setRadius(spec.radiusMeters);
        existing.setStyle({ color: spec.strokeColor, fillColor: spec.fillColor, weight: spec.strokeWidth || 1.5 });
      } else {
        circles[spec.id] = L.circle([spec.center.latitude, spec.center.longitude], {
          radius: spec.radiusMeters,
          color: spec.strokeColor,
          fillColor: spec.fillColor,
          fillOpacity: 1,
          weight: spec.strokeWidth || 1.5,
        }).addTo(map);
      }
    });
    Object.keys(circles).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(circles[id]); delete circles[id]; }
    });
  };

  window.__syncPolyline = function (specJson) {
    if (polylineLayer) { map.removeLayer(polylineLayer); polylineLayer = null; }
    var spec = specJson ? JSON.parse(specJson) : null;
    if (!spec || !spec.coordinates || spec.coordinates.length < 2) return;
    polylineLayer = L.polyline(
      spec.coordinates.map(function (c) { return [c.latitude, c.longitude]; }),
      { color: spec.color, weight: spec.width || 4 }
    ).addTo(map);
  };

  window.__animateToRegion = function (regionJson, durationMs) {
    var r = JSON.parse(regionJson);
    map.flyTo([r.latitude, r.longitude], r.zoom, { duration: (durationMs || 500) / 1000 });
  };

  window.__fitToCoordinates = function (coordsJson, paddingPx) {
    var coords = JSON.parse(coordsJson);
    if (!coords.length) return;
    var bounds = L.latLngBounds(coords.map(function (c) { return [c.latitude, c.longitude]; }));
    map.fitBounds(bounds, { padding: [paddingPx || 60, paddingPx || 60] });
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

// ── Marker HTML templates ───────────────────────────────────────────────────
// Plain HTML/CSS rather than real components — the WebView has no React
// runtime of its own, so these are just enough markup to read as the same
// pin/pill language the rest of the app uses.

export function pinMarkerHtml(color: string, iconGlyph: string): string {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:38px;height:38px;border-radius:19px;background:${color};border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:17px;line-height:1;">${iconGlyph}</span>
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${color};margin-top:-2px;"></div>
    </div>`;
}

export function dotMarkerHtml(color: string): string {
  return `<div style="width:20px;height:20px;border-radius:10px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
}

/** A rotated arrow for the driver's own live position — heading in degrees. */
export function headingMarkerHtml(color: string, headingDeg: number | undefined): string {
  const rotation = typeof headingDeg === "number" ? headingDeg : 0;
  return `
    <div style="width:30px;height:30px;border-radius:15px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transform:rotate(${rotation}deg);">
      <span style="color:#fff;font-size:15px;line-height:1;">&#9650;</span>
    </div>`;
}

/** Branch marker with capability badges — mirrors DeliveryMap's native
 *  BranchMarker (24h / pickup / Rx tags, open/closed dimming, selected
 *  enlargement). Distance chip and the rich callout stay as native RN
 *  overlays driven by markerPress, same pattern as before. */
export function branchMarkerHtml(opts: {
  brandColor: string;
  mutedColor: string;
  surfaceColor: string;
  selected: boolean;
  open: boolean;
  isPrimary: boolean;
  is24h: boolean;
  pickupEnabled: boolean;
  acceptsPrescriptions: boolean;
}): string {
  const size = opts.selected ? 52 : 44;
  const bg = opts.selected ? opts.brandColor : opts.surfaceColor;
  const borderColor = opts.open ? opts.brandColor : opts.mutedColor;
  const iconColor = opts.selected ? "#fff" : opts.open ? opts.brandColor : opts.mutedColor;
  const glyph = opts.isPrimary ? "&#9733;" : "&#10010;";
  const opacity = opts.open ? 1 : 0.65;

  const badges: string[] = [];
  if (opts.is24h) {
    badges.push(`<span style="background:#0B2545;color:#fff;font-size:7px;font-weight:900;padding:2px 4px;border-radius:6px;">24h</span>`);
  }
  if (opts.pickupEnabled) {
    badges.push(`<span style="background:${opts.brandColor}22;border:1px solid ${opts.brandColor};width:14px;height:14px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:8px;">&#128694;</span>`);
  }
  if (opts.acceptsPrescriptions) {
    badges.push(`<span style="background:#FFF3D6;border:1px solid #B8860B;color:#B8860B;font-size:7px;font-weight:900;padding:2px 4px;border-radius:6px;">Rx</span>`);
  }

  return `
    <div style="position:relative;width:${size}px;height:${size}px;opacity:${opacity};">
      <div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${bg};border:2px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
        <span style="color:${iconColor};font-size:14px;">${glyph}</span>
      </div>
      ${badges.length ? `<div style="position:absolute;top:-6px;right:-6px;display:flex;gap:2px;">${badges.join("")}</div>` : ""}
    </div>`;
}
