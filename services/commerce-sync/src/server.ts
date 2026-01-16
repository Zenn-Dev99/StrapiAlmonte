/**
 * Minimal HTTP server (sin dependencias) para recibir webhooks.
 * Nota: Es un esqueleto; completa las funciones TODO antes de usar en producción.
 */
import http from 'http'
import { URL } from 'url'

const PORT = Number(process.env.PORT || 4080)

function json(res: http.ServerResponse, code: number, body: unknown) {
	res.statusCode = code
	res.setHeader('Content-Type', 'application/json; charset=utf-8')
	res.end(JSON.stringify(body))
}

function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = ''
		req.on('data', chunk => (data += chunk))
		req.on('end', () => resolve(data))
		req.on('error', reject)
	})
}

// TODO: validar firmas (Woo/Strapi) y tenants permitidos
function isAllowedTenant(t: string | null) {
	return t === 'moraleja' || t === 'escolar' || t === 'listas'
}

async function handleWooWebhook(tenant: string, body: any, headers: http.IncomingHttpHeaders) {
	// TODO: validar x-wc-webhook-signature
	// TODO: detectar tipo de evento (product/customer create/update/delete)
	// TODO: mapear a estructura Strapi y hacer upsert via REST usando STRAPI_API_TOKEN
	return { ok: true, tenant, source: 'woo' }
}

async function handleStrapiWebhook(tenant: string, body: any, headers: http.IncomingHttpHeaders) {
	// TODO: validar firma de Strapi si se define
	// TODO: detectar tipo de entidad (product/customer)
	// TODO: mapear y hacer upsert en Woo vía REST para el tenant indicado
	return { ok: true, tenant, source: 'strapi' }
}

const server = http.createServer(async (req, res) => {
	try {
		if (!req.url) return json(res, 404, { error: 'Not found' })
		const url = new URL(req.url, `http://${req.headers.host}`)
		const pathname = url.pathname

		if (req.method === 'POST' && pathname.startsWith('/webhooks/woo/')) {
			const tenant = pathname.replace('/webhooks/woo/', '') || null
			if (!tenant || !isAllowedTenant(tenant)) return json(res, 400, { error: 'tenant inválido' })
			const raw = await readBody(req)
			const body = raw ? JSON.parse(raw) : {}
			const out = await handleWooWebhook(tenant, body, req.headers)
			return json(res, 200, out)
		}

		if (req.method === 'POST' && pathname.startsWith('/webhooks/strapi/')) {
			const tenant = pathname.replace('/webhooks/strapi/', '') || null
			if (!tenant || !isAllowedTenant(tenant)) return json(res, 400, { error: 'tenant inválido' })
			const raw = await readBody(req)
			const body = raw ? JSON.parse(raw) : {}
			const out = await handleStrapiWebhook(tenant, body, req.headers)
			return json(res, 200, out)
		}

		return json(res, 404, { error: 'Not found' })
	} catch (err: any) {
		console.error('Unhandled error:', err)
		return json(res, 500, { error: 'internal_error', message: err?.message })
	}
})

server.listen(PORT, () => {
	console.log(`[commerce-sync] listening on port ${PORT}`)
})


