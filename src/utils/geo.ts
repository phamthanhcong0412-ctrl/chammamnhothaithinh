/**
 * Calculate distance in meters between two GPS coordinates using the Haversine formula
 */
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ Geolocation GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        let message = 'Không thể xác định vị trí hiện tại.';
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Vui lòng cho phép quyền truy cập vị trí (GPS) trên thiết bị của bạn.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = 'Tín hiệu GPS không khả dụng hoặc bị chặn.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Quá thời gian lấy vị trí GPS.';
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  });
}
