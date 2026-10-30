import { forwardRef } from 'react';
import Map, { AttributionControl, type MapProps, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Vector tiles from OpenFreeMap: free, no API key, allowed for commercial use (attribution required).
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
// Budapest, until we know where the shops or the customer are.
export const DEFAULT_VIEW = { longitude: 19.0402, latitude: 47.4979, zoom: 12 };

/** The app's map: MapLibre with Regulr's tile style. Children are markers and controls. */
export const MapView = forwardRef<MapRef, Omit<MapProps, 'mapStyle'>>(function MapView({ children, onLoad, ...props }, ref) {
  return (
    <Map
      ref={ref}
      mapStyle={MAP_STYLE}
      attributionControl={false}
      dragRotate={false}
      pitchWithRotate={false}
      onLoad={(e) => {
        // The credits start expanded across the map; fold them into the small (i) button.
        e.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        onLoad?.(e);
      }}
      {...props}
    >
      <AttributionControl compact position="bottom-left" />
      {children}
    </Map>
  );
});
