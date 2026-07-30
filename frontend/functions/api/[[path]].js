const DEFAULT_BACKEND_API_BASE = 'https://part-1-segundo-parcial-desarrollo-de-aplicativ-production.up.railway.app/api'

function buildTargetUrl(base, pathSuffix, search) {
  const normalizedBase = (base || DEFAULT_BACKEND_API_BASE).replace(/\/$/, '')
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

  const headers = new Headers(request.headers)
  headers.delete('host')

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = request.body
  }

  try {
    const upstream = await fetch(target, init)
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
