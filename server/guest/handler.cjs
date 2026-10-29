const { randomBytes, createHmac } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { escape, hashToken, newToken, tokenPattern, unavailable, renderPage, ics, card } = require('./presentation.cjs');
const { socialPng } = require('./raster.cjs');
const { linkConfiguration } = require('./associations.cjs');

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const actions = new Set(['send-code','verify','respond','sign-out','share','attendance','claim']);
const cookieName = '__Host-sb-guest';
class GuestError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function configuration(env) {
  if (env.SB_GUEST_ENABLED !== 'true') throw new GuestError('Guest invitations are not enabled yet.', 503);
  const origin = new URL(env.SB_PUBLIC_ORIGIN || 'https://invalid.local');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.hostname === 'invalid.local') throw new GuestError('Guest invitations are not configured yet.', 503);
  const backend = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  if (!backend || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SB_GUEST_RATE_SECRET) throw new GuestError('Guest invitations are not configured yet.', 503);
  if (new URL(backend).protocol !== 'https:' && env.NODE_ENV !== 'test') throw new GuestError('Guest invitations are not configured yet.', 503);
  return { origin: origin.origin, backend: backend.replace(/\/$/,''), key: env.SUPABASE_SERVICE_ROLE_KEY, rateSecret: env.SB_GUEST_RATE_SECRET };
}
function parseCookie(req) {
  const match = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`));
  if (!match) return null;
  try {
    const value = JSON.parse(Buffer.from(match.slice(cookieName.length+1), 'base64url').toString());
    return typeof value.access_token === 'string' && typeof value.refresh_token === 'string' ? value : null;
  } catch { return null; }
}
function setCookie(res, session) {
  const value = session ? Buffer.from(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })).toString('base64url') : '';
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${session ? 2592000 : 0}`);
}
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new GuestError('Use a JSON request.', 415);
  if (req.body && typeof req.body === 'object') { if (Buffer.byteLength(JSON.stringify(req.body)) > 8192) throw new GuestError('Request too large.', 413); return req.body; }
  let body = typeof req.body === 'string' ? req.body : '';
  if (Buffer.byteLength(body) > 8192) throw new GuestError('Request too large.', 413);
  if (!body) for await (const part of req) { body += part; if (Buffer.byteLength(body) > 8192) throw new GuestError('Request too large.', 413); }
  try { const value = JSON.parse(body); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new GuestError('Invalid request.'); }
}
function makeBackend(config, fetcher) {
  async function call(path, body, bearer = config.key) {
    const response = await fetcher(`${config.backend}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { apikey: config.key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) {
      // Database contract missing or backend unavailable: never silently fall
      // back to client-side participation or expose database diagnostics.
      if (response.status >= 500 || data.code === 'PGRST202') throw new GuestError('Guest invitations are not available yet. Please try again later.', 503);
      if (path.startsWith('/auth/')) throw new GuestError('Verification failed or expired. Request a new code.', 401);
      throw new GuestError(safeDatabaseError(data.message));
    }
    return data;
  }
  return { rpc: (name, body) => call(`/rest/v1/rpc/${name}`, body), auth: (path, body, bearer) => call(`/auth/v1/${path}`, body, bearer) };
}
function safeDatabaseError(message) {
  const allowed = /^(?:Verify your email first\.|Squad Beacon is for ages 16 and older\.|Guest participation is unavailable\.|This invitation is unavailable\.|Responses are closed\.|This beacon is full\. Try again if a spot opens\.|This beacon is closed to new requests\.|Too many requests\. Try again later\.|Choose a supported response\.|Organizer access required\.|No pending request\.|This request was already used\.|Only authorized organizers may share this Beacon\.|Finish your member profile first\.|Choose a future expiry\.|Choose guest access\.)$/;
  const planning = new Set(['Proposed times changed. Refresh before saving.','A proposed time changed.','Choose eligible approved options.','Choose options or None work.','Choose a valid availability time for Interested.','Guest planning responses do not automatically RSVP.','Use the member account that claimed these responses.','These responses were already claimed.','Verify both identities and finish your member profile.','Member accounts cannot be merged through guest claiming.','Status sharing must expire before the note ends.','Select approved Plan stops to share.']);
  planning.add('Status Note changed. Review it before sharing.');
  return allowed.test(message || '') || planning.has(message) ? message : 'Could not complete this action. Refresh the invitation and try again.';
}
async function verifiedActor(backend, req, res, bearerRequired = false) {
  const bearer = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '')?.[1];
  const cookie = parseCookie(req);
  const token = bearerRequired ? bearer : cookie?.access_token;
  if (!token) return null;
  try { const user = await backend.auth('user', undefined, token); return user.email_confirmed_at ? user.id : null; }
  catch (error) {
    if (error.status === 503) throw error;
    if (bearerRequired || !cookie?.refresh_token) return null;
    try {
      const session = await backend.auth('token?grant_type=refresh_token', { refresh_token: cookie.refresh_token });
      if (!session.user?.email_confirmed_at) return null;
      setCookie(res, session); return session.user.id;
    } catch (failure) { if (failure.status === 503) throw failure; setCookie(res, null); return null; }
  }
}

function createHandler({ env = process.env, fetcher = fetch, backend: suppliedBackend } = {}) {
  return async function handler(req, res) {
    const nonce = randomBytes(18).toString('base64');
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
    res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
    const json = (status, data) => { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'https://request.invalid');
      const association=url.searchParams.get('association') || (url.pathname === '/.well-known/apple-app-site-association' ? 'apple' : url.pathname === '/.well-known/assetlinks.json' ? 'android' : null);
      if(association && (req.method==='GET' || req.method==='HEAD')) {
        const links=linkConfiguration(env),data=association==='apple' ? links.apple : association==='android' ? links.android : null;
        return json(data ? 200 : 404,data || {error:'Domain association is not configured.'});
      }
      if (req.method === 'GET' && url.searchParams.get('asset') === 'client') { res.setHeader('Content-Type','application/javascript; charset=utf-8'); return res.end(readFileSync(join(__dirname,'client.js'),'utf8')); }
      const config = configuration(env);
      const backend = suppliedBackend || makeBackend(config,fetcher);
      if (req.method === 'POST') {
        if (req.headers.origin !== config.origin || req.headers['x-sb-guest'] !== '1') throw new GuestError('Open this invitation on its original site.',403);
        const body = await readBody(req);
        if (!actions.has(body.action)) throw new GuestError('Unknown invitation action.');
        if (body.action === 'sign-out') { setCookie(res,null); return json(200,{ signed_out:true }); }
        if (body.action === 'claim') {
          const [guest_id,member_id] = await Promise.all([verifiedActor(backend,req,res),verifiedActor(backend,req,res,true)]);
          if (!guest_id || !member_id) throw new GuestError('Verify guest access in this browser and sign into your member account.',401);
          return json(200,await backend.rpc('guest_claim',{ guest_id,member_id,command:body.command || 'preview' }));
        }
        if (body.action === 'share' || body.action === 'attendance') {
          const actor = await verifiedActor(backend,req,res,true);
          if (!actor) throw new GuestError('Sign in to manage invitations.',401);
          if (!uuid.test(body.target || '')) throw new GuestError('Choose an item to share.');
          if (body.action === 'attendance') {
            if (body.participant != null && !uuid.test(body.participant)) throw new GuestError('Choose a guest.');
            return json(200,await backend.rpc(body.kind === 'decision' ? 'guest_decision_responses' : 'guest_attendance',{ actor,target:body.target,participant:body.participant || null,command:body.command || 'read' }));
          }
          const token = newToken();
          const result = await backend.rpc('guest_share_manage',{ actor,command:body.command,kind:body.kind,target:body.target,settings:body.settings || {},new_hash:hashToken(token) });
          return json(200,{ ...result,...(['enable','regenerate'].includes(body.command) ? { url:`${config.origin}/g/${token}` } : {}) });
        }
        if (!tokenPattern.test(body.token || '')) throw new GuestError('This invitation is unavailable.',404);
        const link_hash = hashToken(body.token);
        if (body.target != null && !uuid.test(body.target)) throw new GuestError('This invitation is unavailable.',404);
        const target = body.target ? { target:body.target } : {};
        const preview = await backend.rpc('guest_preview',{ link_hash,actor:null,...target });
        if (preview.state === 'unavailable') throw new GuestError('This invitation is unavailable.',404);
        if (body.action === 'send-code' || body.action === 'verify') {
          if (preview.access !== 'participate') throw new GuestError('Guest participation is unavailable.',403);
          if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new GuestError('Enter a valid email address.');
          // Trusted proxy address is supplied by Vercel, never by body input.
          const address = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
          const rateKey = value => createHmac('sha256',config.rateSecret).update(value).digest('hex');
          await backend.rpc('guest_auth_limit',{ rate_key:rateKey(`${body.action}:ip:${address}`),command:body.action });
          await backend.rpc('guest_auth_limit',{ rate_key:rateKey(`${body.action}:email:${body.email.trim().toLowerCase()}`),command:body.action });
          if (body.action === 'send-code') {
            await backend.auth('otp',{ email:body.email.trim(),create_user:true });
            return json(200,{ sent:true });
          }
          if (typeof body.code !== 'string' || !/^[0-9]{6,10}$/.test(body.code) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(body.birth || '')) throw new GuestError('Check your code, name and birth date.');
          const session = await backend.auth('verify',{ email:body.email.trim(),token:body.code,type:'email' });
          if (!session.user?.email_confirmed_at) throw new GuestError('Verify your email first.',401);
          await backend.rpc('guest_identity',{ actor:session.user.id,display_name:body.name.trim(),birth:body.birth });
          setCookie(res,session); return json(200,{ verified:true });
        }
        const actor = await verifiedActor(backend,req,res);
        if (!actor) throw new GuestError('Verify your email first.',401);
        if (!uuid.test(body.request || '')) throw new GuestError('Refresh before saving your response.');
        return json(200,await backend.rpc('guest_respond',{ link_hash,actor,command:body.command,payload:body.payload || {},request:body.request,...target }));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow','GET, HEAD, POST'); throw new GuestError('Method not allowed.',405); }
      const pathMatch = /^\/g\/([A-Za-z0-9_-]+)(?:\/(calendar\.ics|card\.svg|card\.png|flyer\.svg))?$/.exec(url.pathname);
      const token = url.searchParams.get('token') || pathMatch?.[1] || '';
      const format = url.searchParams.get('format') || pathMatch?.[2] || '';
      const target = url.searchParams.get('target');
      if (target && !uuid.test(target)) throw new GuestError('This invitation is unavailable.',404);
      const valid = tokenPattern.test(token);
      // Crawlers and rendered metadata never receive cookie-specific responses.
      const actor = valid && !format ? await verifiedActor(backend,req,res) : null;
      const data = valid ? await backend.rpc('guest_preview',{ link_hash:hashToken(token),actor,...(target ? { target } : {}) }) : unavailable();
      if (format === 'calendar.ics') {
        const calendar = ics(data); if (!calendar) throw new GuestError('Calendar details are unavailable.',404);
        res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="squad-beacon.ics"');return res.end(req.method === 'HEAD' ? '' : calendar);
      }
      if (format === 'card.svg' || format === 'card.png' || format === 'flyer.svg') {
        res.setHeader('Content-Type',format === 'card.png' ? 'image/png' : 'image/svg+xml');
        if (format === 'flyer.svg') res.setHeader('Content-Disposition','attachment; filename="squad-beacon-invitation.svg"');
        if(req.method === 'HEAD') return res.end('');
        const svg=await card(data,`${config.origin}/g/${token}${target ? `?target=${target}` : ''}`,format === 'flyer.svg');
        return res.end(format === 'card.png' ? socialPng(svg) : svg);
      }
      res.statusCode = data.state === 'unavailable' ? 404 : 200;
      res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.end(req.method === 'HEAD' ? '' : renderPage(data,{ origin:config.origin,token:valid ? token : '',target,nonce }));
    } catch(error) {
      if (req.method === 'POST') return json(error.status || 503,{ error:error instanceof GuestError ? error.message : 'Invitations are temporarily unavailable. Please try again later.' });
      res.statusCode=error.status || 503; res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squad Beacon invitation</title><main><h1>Invitation temporarily unavailable</h1><p>${escape(error instanceof GuestError ? error.message : 'Please try again later.')}</p></main></html>`);
    }
  };
}
module.exports = { createHandler, configuration, safeDatabaseError };
