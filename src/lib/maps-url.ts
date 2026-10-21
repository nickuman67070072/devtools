export function googleMapsDirectionsUrl(latitude: number, longitude: number) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${latitude},${longitude}`);
  return url.toString();
}
