// Solar terminator calculation for day/night cycle overlay
// Based on NOAA solar position algorithms

export function computeNightPolygon(date?: Date): GeoJSON.FeatureCollection {
  const now = date || new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const fractionalYear = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (now.getUTCHours() - 12) / 24);

  // Solar declination (radians)
  const decl =
    0.006918 -
    0.399912 * Math.cos(fractionalYear) +
    0.070257 * Math.sin(fractionalYear) -
    0.006758 * Math.cos(2 * fractionalYear) +
    0.000907 * Math.sin(2 * fractionalYear) -
    0.002697 * Math.cos(3 * fractionalYear) +
    0.00148 * Math.sin(3 * fractionalYear);

  // Equation of time (minutes)
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(fractionalYear) -
      0.032077 * Math.sin(fractionalYear) -
      0.014615 * Math.cos(2 * fractionalYear) -
      0.04089 * Math.sin(2 * fractionalYear));

  // Sub-solar point
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  const solarNoonOffset = eqtime; // minutes
  const subSolarLng = -(utcMinutes - 720 + solarNoonOffset) / 4; // degrees
  const subSolarLat = (decl * 180) / Math.PI;

  // Build terminator line (great circle perpendicular to sun direction)
  const coords: [number, number][] = [];
  const numPoints = 360;

  for (let i = 0; i <= numPoints; i++) {
    const lng = -180 + (360 * i) / numPoints;
    const lngRad = ((lng - subSolarLng) * Math.PI) / 180;

    // Latitude where sun is at horizon
    const latRad = Math.atan(-Math.cos(lngRad) / Math.tan(decl));
    const lat = (latRad * 180) / Math.PI;

    coords.push([lng, lat]);
  }

  // Build a polygon: terminator line + close around the dark pole
  // The dark pole is opposite the sub-solar point
  const darkPoleLat = subSolarLat > 0 ? -90 : 90;

  const polygon: [number, number][] = [];

  // Start with the terminator line
  if (darkPoleLat < 0) {
    // Night is in the south - go along terminator then close via south pole
    polygon.push(...coords);
    polygon.push([180, darkPoleLat]);
    polygon.push([-180, darkPoleLat]);
    polygon.push(coords[0]); // close
  } else {
    // Night is in the north - reverse terminator then close via north pole
    polygon.push(...coords.reverse());
    polygon.push([-180, darkPoleLat]);
    polygon.push([180, darkPoleLat]);
    polygon.push(coords[coords.length - 1]); // close
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [polygon],
        },
      },
    ],
  };
}
