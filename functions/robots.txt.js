// Robots.txt diverso per ambiente, sullo stesso build statico condiviso fra
// produzione e test (stesso dist, due branch Cloudflare Pages). Il branch
// `test` ha già di suo un header `X-Robots-Tag: noindex` automatico di
// Cloudflare (branch non di produzione) — questo file rincara la dose in modo
// esplicito e copre anche i crawler che guardano solo robots.txt.
export function onRequest({ request }) {
  const host = new URL(request.url).hostname;
  const isTest = host.startsWith('test.');
  const body = isTest
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\n';
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
