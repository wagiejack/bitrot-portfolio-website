import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

/**
 * The DEBUG flag will do two things:
 * 1. We will skip caching on the edge, which makes it easier to debug
 * 2. We will return an error message on exception in your Response
 */
const DEBUG = false

addEventListener('fetch', event => {
  try {
    event.respondWith(handleEvent(event))
  } catch (e) {
    if (DEBUG) {
      return event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500,
        }),
      )
    }
    event.respondWith(new Response('Internal Error', { status: 500 }))
  }
})

/**
 * Handle the request and serve static assets
 * @param {Event} event
 */
async function handleEvent(event) {
  const url = new URL(event.request.url)
  let options = {}

  // Handle redirects for homepage
  if (url.pathname === '/' || url.pathname === '') {
    return Response.redirect(`${url.origin}/main.html`, 301)
  }

  try {
    // Get the static asset
    let response = await getAssetFromKV(event, options)
    
    // Set cache control headers
    let headers = new Headers(response.headers)
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('Referrer-Policy', 'unsafe-url')
    headers.set('Feature-Policy', 'none')
    
    // Cache control headers
    if (DEBUG) {
      headers.set('Cache-Control', 'no-store')
    } else {
      const maxAge = 60 * 60 * 24 * 30 // 30 days
      headers.set('Cache-Control', `public, max-age=${maxAge}`)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (e) {
    // If an error is thrown try to serve the 404 page
    if (e.status === 404) {
      // If you don't have a custom 404 page, you can return a simple message
      return new Response('404 - Page not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/html'
        }
      })
    }
    
    return new Response(e.message || e.toString(), { status: 500 })
  }
}