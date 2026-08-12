const DEFAULT_BACKEND_API_BASE = 'https://edumatrics-dr.up.railway.app'

function buildTargetUrl(base, pathSuffix, search) {
  const rawBase = (base || DEFAULT_BACKEND_API_BASE).replace(/[\[\]'\"]/g, '').replace(/\/$/, '')
  const normalizedBase = rawBase || DEFAULT_BACKEND_API_BASE
  const normalizedSuffix = pathSuffix ? `/${pathSuffix}` : ''
  return `${normalizedBase}${normalizedSuffix}${search || ''}`
}

export async function onRequest(context) {
  const { request, env, params } = context

  const pathParam = params?.path
  const pathSuffix = Array.isArray(pathParam)
    ? pathParam.join('/')
    : (pathParam || '').toString()

  const url = new URL(request.url)
  const target = buildTargetUrl(env?.BACKEND_API_BASE, pathSuffix, url.search)

  try {
    const incoming = new Request(target, request)
    const headers = new Headers(incoming.headers)
    headers.delete('host')

    const forwarded = new Request(incoming, {
      headers,
      redirect: 'follow',
    })

    const upstream = await fetch(forwarded)
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    })
  } catch {
    return Response.json(
      {
        error: 'No fue posible conectar con el backend upstream.',
        detail: 'Cloudflare Pages proxy no pudo alcanzar Railway.',
      },
      { status: 502 },
    )
  }
}
