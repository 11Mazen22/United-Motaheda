/**
 * html.ts — builds the static HTML/JS document that runs inside the
 * WebView, plus the small marker-icon templates used across the app's three
 * map screens. See LeafletMap.tsx for the RN-side half of this bridge.
 *
 * Renders with MapLibre GL JS against MapTiler's vector style (not raster
 * tiles). This is the reason: MapTiler's raster PNG tile endpoint bakes in
 * labels at render time and ignores the `language` query param entirely
 * (confirmed live — identical byte-for-byte output with and without it), so
 * every place/street/POI label rendered in English regardless of the
 * device's language. The underlying vector data does carry a full set of
 * per-language name fields including `name:ar` for Egyptian streets/places/
 * POIs (confirmed by decoding a real Cairo tile directly) — vector tiles
 * are the only way to actually reach that data, since MapLibre can rewrite
 * each label layer's `text-field` expression at runtime instead of trusting
 * whatever language a pre-rendered raster image happened to bake in.
 */
import type { MapRegion } from "./types";

/**
 * Full HTML document, parameterised only by the initial region/zoom and the
 * MapTiler vector style URL. Everything else (markers, circles, polylines,
 * camera moves) is pushed in afterwards via `injectJavaScript` calls into
 * the global functions defined at the bottom of this document — see
 * LeafletMap.tsx's `run()` helper for the RN side of each call.
 *
 * MapLibre GL JS loads from a CDN rather than being bundled: it's a request
 * the device makes once per screen mount, no different in kind from the
 * tile requests the map needs anyway, and it avoids adding a bundler asset
 * step for a WebView-only dependency.
 */
export function buildMapHtml(initialRegion: MapRegion, styleUrl: string, zoomControl: boolean, interactive: boolean = true): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.8.0/dist/maplibre-gl.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #eef1f4; }
  .maplibregl-ctrl-attrib { font-size: 9px; }
  .maplibregl-marker { transition: transform 120ms ease; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@5.8.0/dist/maplibre-gl.js"></script>
<script>
window.onerror = function (message, source, lineno, colno, error) {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(message) + ' @' + lineno + ':' + colno }));
  } catch (e) {}
  return false;
};
(function () {
  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  post({ type: 'error', message: 'diag: maplibregl=' + (typeof maplibregl) + ' version=' + (maplibregl && maplibregl.version) });

  // Without this, MapLibre lays out Arabic/Hebrew glyphs in raw logical
  // (memory) order instead of applying bidi reordering + letter-joining —
  // confirmed live: a real label came out mirrored ("لاف يتسف ورياك" for
  // what is actually "كايرو فستيفال سيتي مول"). This plugin is what
  // Mapbox/MapLibre GL JS require for correct RTL script shaping; it's not
  // optional, the renderer has no built-in fallback for it.
  try {
    maplibregl.setRTLTextPlugin(
      'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js',
      true
    );
  } catch (e) {
    post({ type: 'error', message: 'diag: setRTLTextPlugin threw: ' + (e && e.message) });
  }

  var map;
  try {
    map = new maplibregl.Map({
      container: 'map',
      style: ${JSON.stringify(styleUrl)},
      center: [${initialRegion.longitude}, ${initialRegion.latitude}],
      zoom: ${initialRegion.zoom},
      attributionControl: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      dragPan: ${JSON.stringify(interactive)},
      scrollZoom: ${JSON.stringify(interactive)},
      boxZoom: ${JSON.stringify(interactive)},
      keyboard: ${JSON.stringify(interactive)},
      doubleClickZoom: ${JSON.stringify(interactive)},
      touchZoomRotate: ${JSON.stringify(interactive)},
    });
    post({ type: 'error', message: 'diag: map constructed ok' });
  } catch (e) {
    post({ type: 'error', message: 'diag: map construction threw: ' + (e && e.message) });
    return;
  }
  map.touchZoomRotate.disableRotation();
  if (${JSON.stringify(zoomControl)}) {
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  }

  // MapTiler's style layers default label text to name:en. Rewrite every
  // layer whose text-field references a name or name:xx property (the
  // style's own coalesce chains, and the flat "{name}"/"{name:en}" string
  // templates most POI/place layers use) to prefer name:ar. Layers keyed on
  // something else entirely (ref, housenumber, iata) never mention "name"
  // in their expression and are left untouched. Wrapped so a bug here can
  // never block the ready/tile-render pipeline below it.
  function preferArabicLabels() {
    try {
      var layers = map.getStyle().layers;
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (!layer.layout || !layer.layout['text-field']) continue;
        if (JSON.stringify(layer.layout['text-field']).indexOf('name') === -1) continue;
        map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ar'], ['get', 'name']]);
      }
      post({ type: 'error', message: 'diag: preferArabicLabels ok, ' + layers.length + ' layers scanned' });
    } catch (e) {
      post({ type: 'error', message: 'diag: preferArabicLabels threw: ' + (e && e.message) });
    }
  }

  var markers = {};   // id -> { marker, el, html }
  var polylineLayerIds = [];
  var circleLayerIds = {}; // id -> [fillLayerId, lineLayerId]
  var ready = false;
  var pendingCalls = [];

  function whenReady(fn) {
    if (ready) fn(); else pendingCalls.push(fn);
  }

  map.on('load', function () {
    post({ type: 'error', message: 'diag: load fired' });
    preferArabicLabels();
    ready = true;
    pendingCalls.forEach(function (fn) { fn(); });
    pendingCalls = [];
    post({ type: 'ready' });
  });

  map.on('error', function (e) {
    post({ type: 'error', message: (e && e.error && e.error.message) || 'unknown' });
  });

  map.on('click', function (e) {
    post({ type: 'press', lat: e.lngLat.lat, lng: e.lngLat.lng });
  });

  // ── Geodesic circle polygon (MapLibre's circle layer uses a pixel radius
  // that changes apparent size with zoom; a delivery-zone radius needs to
  // stay the same real-world size, so we compute the actual ground-distance
  // polygon ourselves — same shape Leaflet's L.circle produced). ──────────
  function circlePolygon(centerLng, centerLat, radiusMeters, steps) {
    var coords = [];
    var earthRadius = 6371000;
    var latRad = centerLat * Math.PI / 180;
    var lngRad = centerLng * Math.PI / 180;
    var angDist = radiusMeters / earthRadius;
    for (var i = 0; i <= steps; i++) {
      var bearing = (i / steps) * 2 * Math.PI;
      var lat2 = Math.asin(Math.sin(latRad) * Math.cos(angDist) + Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing));
      var lng2 = lngRad + Math.atan2(
        Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
        Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat2)
      );
      coords.push([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }
    return coords;
  }

  // ── Called from React Native ──────────────────────────────────────────
  window.__syncMarkers = function (specsJson) {
    whenReady(function () {
      var specs = JSON.parse(specsJson);
      var seen = {};
      specs.forEach(function (spec) {
        seen[spec.id] = true;
        var lngLat = [spec.coordinate.longitude, spec.coordinate.latitude];
        var offset = [
          spec.width / 2 - spec.width * spec.anchorX,
          spec.height / 2 - spec.height * spec.anchorY,
        ];
        var existing = markers[spec.id];
        if (existing) {
          existing.marker.setLngLat(lngLat);
          if (existing.html !== spec.html) {
            existing.el.innerHTML = spec.html;
            existing.html = spec.html;
          }
        } else {
          var el = document.createElement('div');
          el.innerHTML = spec.html;
          el.style.width = spec.width + 'px';
          el.style.height = spec.height + 'px';
          el.addEventListener('click', function (e) {
            e.stopPropagation();
            post({ type: 'markerPress', id: spec.id });
          });
          var m = new maplibregl.Marker({
            element: el,
            anchor: 'center',
            offset: offset,
            draggable: !!spec.draggable,
          }).setLngLat(lngLat).addTo(map);
          m.on('dragend', function () {
            var ll = m.getLngLat();
            post({ type: 'markerDragEnd', id: spec.id, lat: ll.lat, lng: ll.lng });
          });
          markers[spec.id] = { marker: m, el: el, html: spec.html };
        }
        if (typeof spec.zIndexOffset === 'number') {
          markers[spec.id].el.style.zIndex = String(1000 + spec.zIndexOffset);
        }
      });
      Object.keys(markers).forEach(function (id) {
        if (!seen[id]) { markers[id].marker.remove(); delete markers[id]; }
      });
    });
  };

  window.__syncCircles = function (specsJson) {
    whenReady(function () {
      var specs = JSON.parse(specsJson);
      var seen = {};
      specs.forEach(function (spec) {
        seen[spec.id] = true;
        var sourceId = 'circle-src-' + spec.id;
        var fillId = 'circle-fill-' + spec.id;
        var lineId = 'circle-line-' + spec.id;
        var polygon = circlePolygon(spec.center.longitude, spec.center.latitude, spec.radiusMeters, 64);
        var geojson = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [polygon] } };
        var source = map.getSource(sourceId);
        if (source) {
          source.setData(geojson);
          map.setPaintProperty(fillId, 'fill-color', spec.fillColor);
          map.setPaintProperty(lineId, 'line-color', spec.strokeColor);
          map.setPaintProperty(lineId, 'line-width', spec.strokeWidth || 1.5);
        } else {
          map.addSource(sourceId, { type: 'geojson', data: geojson });
          map.addLayer({ id: fillId, type: 'fill', source: sourceId, paint: { 'fill-color': spec.fillColor, 'fill-opacity': 1 } });
          map.addLayer({ id: lineId, type: 'line', source: sourceId, paint: { 'line-color': spec.strokeColor, 'line-width': spec.strokeWidth || 1.5 } });
          circleLayerIds[spec.id] = [fillId, lineId, sourceId];
        }
      });
      Object.keys(circleLayerIds).forEach(function (id) {
        if (!seen[id]) {
          var ids = circleLayerIds[id];
          if (map.getLayer(ids[0])) map.removeLayer(ids[0]);
          if (map.getLayer(ids[1])) map.removeLayer(ids[1]);
          if (map.getSource(ids[2])) map.removeSource(ids[2]);
          delete circleLayerIds[id];
        }
      });
    });
  };

  window.__syncPolyline = function (specJson) {
    whenReady(function () {
      polylineLayerIds.forEach(function (id) {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('polyline-src')) map.removeSource('polyline-src');
      polylineLayerIds = [];

      var spec = specJson ? JSON.parse(specJson) : null;
      if (!spec || !spec.coordinates || spec.coordinates.length < 2) return;

      map.addSource('polyline-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: spec.coordinates.map(function (c) { return [c.longitude, c.latitude]; }) },
        },
      });
      map.addLayer({
        id: 'polyline-layer',
        type: 'line',
        source: 'polyline-src',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': spec.color,
          'line-width': spec.width || 4,
          'line-dasharray': spec.dashed ? [2, 2] : [1],
        },
      });
      polylineLayerIds = ['polyline-layer'];
    });
  };

  window.__animateToRegion = function (regionJson, durationMs) {
    whenReady(function () {
      var r = JSON.parse(regionJson);
      map.flyTo({ center: [r.longitude, r.latitude], zoom: r.zoom, duration: durationMs || 500 });
    });
  };

  window.__fitToCoordinates = function (coordsJson, paddingPx) {
    whenReady(function () {
      var coords = JSON.parse(coordsJson);
      if (!coords.length) return;
      var lngs = coords.map(function (c) { return c.longitude; });
      var lats = coords.map(function (c) { return c.latitude; });
      var bounds = [[Math.min.apply(null, lngs), Math.min.apply(null, lats)], [Math.max.apply(null, lngs), Math.max.apply(null, lats)]];
      map.fitBounds(bounds, { padding: paddingPx || 60 });
    });
  };
})();
</script>
</body>
</html>`;
}

// ── Marker HTML templates ───────────────────────────────────────────────────
// Plain HTML/CSS rather than real components — the WebView has no React
// runtime of its own, so these are just enough markup to read as the same
// pin/pill language the rest of the app uses. Consumed as a MapLibre Marker
// element's innerHTML (see __syncMarkers above).

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
