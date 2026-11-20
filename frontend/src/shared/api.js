export async function api(path, data) {
  const response = await fetch(
    '/api' + path,
    data === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
  )
  const body = await response.json()
  if (!response.ok) {
    const error = new Error(body.error || 'Request failed.')
    error.status = response.status
    throw error
  }
  return body
}
