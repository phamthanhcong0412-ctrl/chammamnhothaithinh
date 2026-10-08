/**
 * DOMAIN: GeoLocationCalculator
 * Chuyên trách: Tính toán tọa độ và bán kính địa lý (Pure Domain Logic - SRP)
 */

export function calculateGpsDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Bán kính trái đất tính bằng mét
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function isGpsWithinStoreRadius(
  userGps: { lat: number; lng: number } | undefined,
  storeGps: { lat: number; lng: number; radiusMeters?: number }
): { isAllowed: boolean; distanceMeters: number; maxRadiusMeters: number; error?: string } {
  const maxRadiusMeters = storeGps.radiusMeters || 80;

  if (!userGps || typeof userGps.lat !== 'number' || typeof userGps.lng !== 'number') {
    return {
      isAllowed: false,
      distanceMeters: 0,
      maxRadiusMeters,
      error: 'Vui lòng bật quyền truy cập vị trí trên trình duyệt.',
    };
  }

  const distanceMeters = calculateGpsDistanceMeters(
    userGps.lat,
    userGps.lng,
    storeGps.lat,
    storeGps.lng
  );

  const isAllowed = distanceMeters <= maxRadiusMeters;

  return {
    isAllowed,
    distanceMeters,
    maxRadiusMeters,
    error: isAllowed
      ? undefined
      : `Bạn đang ở cách quán ${distanceMeters}m (vượt quá bán kính cho phép ${maxRadiusMeters}m).`,
  };
}
