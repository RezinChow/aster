/** Open-Meteo geocoding plus the current temperature. No model call. */

export async function currentWeather(city, fetchImpl = fetch) {
  const name = city.trim()
  if (!name) throw new Error('城市不能为空')
  const place = await geocode(name, fetchImpl)
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('current', 'temperature_2m')
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`open-meteo ${response.status}`)
  const body = await response.json()
  const temperature = body?.current?.temperature_2m
  if (typeof temperature !== 'number') throw new Error('open-meteo 没有返回气温')
  const unit = body.current_units?.temperature_2m ?? '°C'
  return `${place.label} 当前 ${temperature} ${unit}`
}

async function geocode(name, fetchImpl) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', name)
  url.searchParams.set('count', '1')
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`open-meteo geocoding ${response.status}`)
  const body = await response.json()
  const place = body?.results?.[0]
  if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
    throw new Error(`没有找到城市 ${name}`)
  }
  const label = [place.name, place.country].filter((part) => typeof part === 'string' && part).join('，')
  return { latitude: place.latitude, longitude: place.longitude, label: label || name }
}
