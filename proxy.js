import { parse } from "https://deno.land/std/flags/mod.ts";
import { serve, serveTls } from "https://deno.land/std/http/mod.ts";

const { h, help, certFile, keyFile, auth } = parse(Deno.args)

const HELP = `Deno https proxy serve 1.0.0

USAGE:
    proxy [OPTIONS]

OPTIONS:
    -h, --help                      Print help information
        --certFile=<certFilePath>   Assign certFile to enable HTTPS server, must use with --keyFile
        --keyFile=<keyFilePath>     Assign keyFile to enable HTTPS server, must use with --certFile
        --auth=<authFilePath>       Assign authorization file to enable web basic authorization`
if(h || help) {
    console.log(HELP)
    Deno.exit(0)
}

const params = {
    hostname: '::',
    certFile,
    keyFile,
}

certFile ? serveTls(handle, params) : serve(handle, params)
const authString = auth ? Deno.readTextFileSync(auth) : ''
const users = authString.match(/^(\w|:)+/gm)
if(auth) {
    certFile || console.warn('[Warning] pass basic authorization in HTTP is unsafely, please consider use HTTPS')
    console.info(`load ${users.length} valid user`)
}

/**
 * return string with bracket if it is ipv6
 * example: 127.0.0.1 → 127.0.0.1
 *          ::1 → [::1]
 * @param {string} addr ip address
 * @return {string} for ipv4, will return itself. for ipv6, it returns bracket wrapped.
 */
function wrapIPv6 (addr){
    return addr.includes(':') ? `[${addr}]` : addr
}

/**
 * check header this request whether proxy by self
 * @param {Headers} headers request's header
 * @param {string} by serve proxy by field
 */
function isSelfRequest(headers, by) {
    return headers.get('forwarded')?.split(',').some(forwarded => {
        for(const s of forwarded.split(';')) {
            const [key, value] = s.split('=')
            if(key === 'by' && value === by) {
                return true
            }
        }
        return false
    })
}

/**
 * handle upgrade connect
 * @param {Request} request
 * @return {Promise<Response>}
 */
async function handleConnect(request) {
    const url = new URL(request.url)

    /** @type { Deno.TcpConn } */
    let destConn
    try {
        destConn = await Deno.connect({ hostname: url.hostname, port: Number(url.port || '443') })
    }
    catch (e) {
        // Honestly, I don't know why it was error here
        return
    }

    const p = Deno.upgradeHttp(request);

    (async () => {
        const [conn] = await p
        conn.readable.pipeTo(destConn.writable).catch(() => {})
        destConn.readable.pipeTo(conn.writable).catch(() => {})
    })().then(() => {})
    return new Response(null, { status: 200, statusText: 'Connection Established' })
}

const AUTH_RESPONSE_INIT = { status: 407, headers: {'proxy-authenticate': 'basic realm="proxy"'}}
/**
 * handle HTTP Request
 * @param {Request} request
 * @param {Deno.NetAddr} localAddr
 * @param {Deno.NetAddr} remoteAddr
 * @return {Promise<Response>}
 */
async function handle(request, { localAddr, remoteAddr }) {
    const by = `${wrapIPv6(localAddr.hostname)}:${localAddr.port}`;
    const headers = new Headers(request.headers)

    /* prevent self-cycle */
    if(isSelfRequest(headers, by)) {
        return new Response('It work!')
    }

    /* authorize */
    if(auth) {
        const authorization = request.headers.get('proxy-authorization')
        if(!authorization) return new Response(null, AUTH_RESPONSE_INIT)
        let [, credentials] = authorization.split(' ')
        credentials = atob(credentials)
        if(!users.includes(credentials)) return new Response(null, AUTH_RESPONSE_INIT)
    }

    if(request.method === 'CONNECT') return handleConnect(request)

    // add proxy header
    const forwarded = {
        by,
        for: `${wrapIPv6(remoteAddr.hostname)}:${remoteAddr.port}`,
        host: request.headers.get('host'),
        proto: certFile ? 'https' : 'http',
    }
    headers.append('forwarded', Object.entries(forwarded).map(record => record.join('=')).join(';'))

    // deal hop-by-hop header
    headers.delete('keep-alive')
    headers.delete('transfer-encoding')
    headers.delete('te')
    headers.delete('trailer')
    headers.delete('upgrade')
    headers.delete('upgrade')
    headers.delete('proxy-authorization')
    headers.delete('proxy-authenticate')
    const connection = headers.get('connection')
    if (connection && connection !== 'close') {
        headers.delete('connection')
        connection.split(',').forEach(header => headers.delete(header))
    }

    return fetch(request.url.replace(/^https:/, 'http:'), {
        headers,
        method: request.method,
        body: request.body,
        mode: request.mode,
        credentials: request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrer: request.referrer,
        integrity: request.integrity,
    });
}
