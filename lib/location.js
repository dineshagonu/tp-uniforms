const cache = new Map();

export async function lookupPincode(pin) {
  if (cache.has(pin)) return cache.get(pin);
  const res = await fetch('/api/pincode/' + pin);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Pincode not found');
  cache.set(pin, data);
  return data;
}

/** Asks the phone for GPS, then converts it to pincode + village. */
export function detectLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location not supported on this device'));
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`/api/locate?lat=${coords.latitude}&lon=${coords.longitude}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          resolve(data);
        } catch { reject(new Error('Could not find your address. Please type your pincode.')); }
      },
      (e) => reject(new Error(e.code === 1
        ? 'Location permission denied. Allow location or type your pincode.'
        : 'Could not get your location. Please type your pincode.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  });
}
