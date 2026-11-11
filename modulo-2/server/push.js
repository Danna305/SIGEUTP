/* =====================================================================
   SIGEP UTP · Notificaciones push (Web Push) sin paquetes extra
   - Llaves VAPID (RFC 8292): identifican a este servidor ante el servicio
     de notificaciones del navegador (Google, Mozilla, Apple, Microsoft).
   - Cifrado del mensaje "aes128gcm" (RFC 8291): solo el navegador que se
     suscribió puede leer la notificación.
   Las llaves se crean solas la primera vez y se guardan en data/vapid.json.
   ===================================================================== */
const crypto = require('crypto');
const fs = require('fs');

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (llave, datos) => crypto.createHmac('sha256', llave).update(datos).digest();

let VAPID = null;   // { publica (base64url, 65 bytes), privada (KeyObject), sujeto }

function iniciar(archivo, sujeto = 'mailto:estadias@utpuebla.edu.mx') {
  let jwk;
  try { jwk = JSON.parse(fs.readFileSync(archivo, 'utf8')); }
  catch (e) {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    jwk = privateKey.export({ format: 'jwk' });
    fs.writeFileSync(archivo, JSON.stringify(jwk));
  }
  const privada = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const publica = b64u(Buffer.concat([Buffer.from([4]), deB64u(jwk.x), deB64u(jwk.y)]));
  VAPID = { publica, privada, sujeto };
  return publica;
}
const llavePublica = () => VAPID && VAPID.publica;

// Encabezado Authorization: un token JWT firmado con ES256 para el servicio de push
function encabezadoVapid(endpoint) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const cuerpo = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID.sujeto }));
  const firma = crypto.sign('sha256', Buffer.from(`${cab}.${cuerpo}`), { key: VAPID.privada, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${cab}.${cuerpo}.${b64u(firma)}, k=${VAPID.publica}`;
}

// Cifra el mensaje para una suscripción (RFC 8291)
function cifrar(suscripcion, texto, prueba) {   // "prueba" fija llave y sal (solo para verificar con el ejemplo del RFC)
  const uaPublica = deB64u(suscripcion.keys.p256dh);      // llave del navegador (65 bytes)
  const auth = deB64u(suscripcion.keys.auth);             // secreto compartido (16 bytes)
  const ecdh = crypto.createECDH('prime256v1');
  if (prueba) ecdh.setPrivateKey(deB64u(prueba.privada));
  const asPublica = prueba ? ecdh.getPublicKey() : ecdh.generateKeys();   // llave temporal del servidor
  const secreto = ecdh.computeSecret(uaPublica);
  const prkClave = hmac(auth, secreto);
  const ikm = hmac(prkClave, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublica, asPublica, Buffer.from([1])]));
  const sal = prueba ? deB64u(prueba.sal) : crypto.randomBytes(16);
  const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cifrador = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const datos = Buffer.concat([cifrador.update(Buffer.concat([Buffer.from(texto), Buffer.from([2])])), cifrador.final(), cifrador.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([asPublica.length]), asPublica, datos]);
}

// Envía una notificación. Devuelve { ok, status }; status 404/410 = suscripción vencida
async function enviar(suscripcion, mensaje, ttl = 86400) {
  if (!VAPID) throw new Error('Las notificaciones push no están iniciadas.');
  const cuerpo = cifrar(suscripcion, JSON.stringify(mensaje));
  try {
    const r = await fetch(suscripcion.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: String(ttl), Urgency: 'high', Authorization: encabezadoVapid(suscripcion.endpoint) },
      body: cuerpo
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.cause?.code || e.message };
  }
}

module.exports = { iniciar, llavePublica, enviar, cifrar, encabezadoVapid, b64u, deB64u };
