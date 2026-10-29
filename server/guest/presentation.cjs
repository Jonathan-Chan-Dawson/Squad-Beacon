const { randomBytes, createHash } = require('node:crypto');
const QRCode = require('qrcode');

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
const safePath = path => typeof path === 'string' && /^\/(activity|council|plan)\/[a-zA-Z0-9-]+$/.test(path) ? path : null;
const labels = { open: 'You’re invited', full: 'This Beacon is full', closed: 'New responses are closed', cancelled: 'This Beacon was cancelled', ended: 'This Beacon has ended', unavailable: 'Invitation unavailable' };
const responseLabel = value => ({ requested: 'Pending organizer approval', going: 'Going', interested: 'Interested', declined: 'Declined' })[value] || '';
const unavailable = () => ({ state: 'unavailable' });

function dateRange(data) {
  if (!data.starts_at || !data.ends_at) return '';
  try {
    const format = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: data.timezone || 'UTC' });
    return `${format.format(new Date(data.starts_at))} – ${format.format(new Date(data.ends_at))} (${data.timezone || 'UTC'})`;
  } catch { return ''; }
}

function renderPage(data, { origin, token, nonce, target = null }) {
  const available = data.state && data.state !== 'unavailable';
  const title = available ? data.title : 'Invitation unavailable';
  const base = `${origin}/g/${token}`;
  const query = target ? `?target=${encodeURIComponent(target)}` : '';
  const resource = name => `${base}/${name}${query}`;
  const desc = available ? data.description || 'An invitation from Squad Beacon.' : 'This invitation may have expired or been disabled. Ask the organizer for a new link.';
  const canRespond = available && data.access === 'participate' && ['beacon','ping','vote','time'].includes(data.kind) && !['cancelled', 'ended'].includes(data.state) && (data.kind === 'beacon' || data.state === 'open');
  const appPath = available ? safePath(data.app_path) : null;
  const capacity = data.capacity_limit != null && available ? `<p class="muted">${escape(data.seat_count)} / ${escape(data.capacity_limit)} confirmed places</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${escape(title)} · Squad Beacon</title>
<meta name="description" content="${escape(desc)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Squad Beacon"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(desc)}">${available ? `<meta property="og:image" content="${escape(resource('card.png'))}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ''}<meta name="twitter:card" content="summary_large_image">
<style nonce="${nonce}">${styles}${planningStyles}</style></head><body><main><header><span class="mark" aria-hidden="true">◉</span><span>Squad Beacon</span></header><article aria-labelledby="title"><p class="eyebrow">${escape(labels[data.state] || 'You’re invited')}</p><h1 id="title">${escape(title)}</h1>${available ? `<p class="time">${escape(dateRange(data))}</p>${data.area_label ? `<p class="muted">${escape(data.area_label)}</p>` : ''}` : ''}<p class="description">${escape(desc)}</p>${capacity}
${data.response ? `<p class="confirmation" role="status">Your response: ${escape(responseLabel(data.response))}</p>` : ''}
${available ? planningReadOnly(data,base) : ''}
${canRespond ? `<section aria-label="Your response">${data.verified ? (data.kind === 'beacon' ? responseForm(data) : planningForm(data)) : verificationForm()}<p id="feedback" role="status" aria-live="polite"></p></section>` : ''}
${available ? `<footer>${data.kind === 'beacon' && data.starts_at ? `<a class="secondary" href="${escape(resource('calendar.ics'))}">Add to calendar</a><a class="secondary" href="${escape(googleCalendar(data))}">Google Calendar</a>` : ''}${appPath ? `<a class="secondary" href="${escape(origin + appPath)}">Open in Squad Beacon</a>` : ''}${data.verified ? `<a class="secondary" href="${escape(`${origin}/guest-claim?invitation=${token}${target ? `&target=${target}` : ''}`)}">Keep responses when you join</a>` : ''}<a class="quiet" href="${escape(resource('flyer.svg'))}">Download QR invitation</a></footer>` : ''}
</article><p class="privacy">Your response is shared with the organizer. This invitation does not join a Squad or share your location.</p>${data.verified ? '<button class="quiet" id="sign-out" type="button">Sign out of guest access</button>' : ''}</main><script nonce="${nonce}" src="/api/guest?asset=client"></script></body></html>`;
}

function planningReadOnly(data,base) {
  const when = value => { try { return new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:data.timezone || 'UTC'}); } catch { return ''; } };
  let html = data.deadline_at ? `<p class="muted">Respond by ${escape(when(data.deadline_at))} (${escape(data.timezone || 'UTC')})</p>` : '';
  if(data.note) html += `<blockquote class="confirmation">${escape(data.note)}</blockquote><p class="muted">This selected text snapshot expires ${escape(when(data.expires_at))}.</p>`;
  if(data.kind === 'plan') html += `<ol class="stops">${(data.stops || []).map(stop=>`<li><h2>${escape(stop.title)}</h2>${stop.starts_at ? `<p>${escape(when(stop.starts_at))}</p>` : ''}${stop.target ? `<a class="secondary" href="${escape(`${base}?target=${stop.target}`)}">View shared stop</a>` : ''}</li>`).join('')}</ol>`;
  if(data.kind === 'draw') html += `<h2>Approved options</h2><ul>${(data.options || []).map(option=>`<li>${escape(option.title)}${option.id === data.winner_proposal_id ? ' · Selected by the organizer’s Draw' : ''}</li>`).join('')}</ul><p class="muted">Only the organizer can run or finalize this Draw.</p>`;
  if(data.saved && !['beacon','draw','plan','status'].includes(data.kind)) html += `<p class="confirmation" role="status">Your ${data.kind === 'time' ? 'availability' : data.kind === 'ping' ? 'response' : 'vote'} is saved${data.saved.response ? `: ${escape(data.saved.response)}` : ''}.</p>`;
  if(data.result_target) html += `<a class="secondary" href="${escape(`${base}?target=${data.result_target}`)}">View resulting Beacon</a><p class="muted">A planning response does not mean you are Going. Review the Beacon to RSVP.</p>`;
  else if(data.status === 'resolved') html += '<p class="muted">The decision is resolved. Its resulting Beacon is not shared externally.</p>';
  return html;
}

function planningForm(data) {
  const saved = data.saved || {};
  let fields = '';
  if(data.kind === 'ping') fields = `<label for="ping-response">Your response</label><select id="ping-response" name="response">${['interested','maybe','pass'].map(value=>`<option value="${value}" ${saved.response === value ? 'selected' : ''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select><label for="available-after">Available after (optional, your local time)</label><input id="available-after" name="available_after" type="datetime-local" data-saved="${escape(saved.available_after || '')}"><p class="muted">Availability preferences apply only to Interested. This does not automatically RSVP to a Beacon.</p>`;
  if(data.kind === 'vote') fields = `<fieldset><legend>${data.vote_method === 'approval' ? 'Choose all options that work' : 'Choose one approved option'}</legend>${(data.options || []).map(option=>`<label class="choice"><input type="${data.vote_method === 'approval' ? 'checkbox' : 'radio'}" name="${data.vote_method === 'approval' ? 'proposal_ids' : 'proposal_id'}" value="${escape(option.id)}" ${(saved.proposal_ids || [saved.proposal_id]).includes(option.id) ? 'checked' : ''}>${escape(option.title)}<span class="muted">${escape(dateRange(option))}</span></label>`).join('')}${data.vote_method === 'approval' ? `<label class="choice"><input type="checkbox" name="none_work" ${saved.none_work ? 'checked' : ''}>None work</label>` : ''}</fieldset>`;
  if(data.kind === 'time') fields = `${saved.slots_revision && saved.slots_revision !== data.slots_revision ? '<p class="confirmation">Proposed times changed. Review the current slots before saving.</p>' : ''}${(data.slots || []).map(slot=>`<fieldset><legend>${escape(dateRange(slot))}</legend>${['yes','maybe','no'].map(answer=>`<label class="choice"><input type="radio" name="slot:${escape(slot.id)}" value="${answer}" ${saved.slots_revision === data.slots_revision && saved.answers?.[slot.id] === answer ? 'checked' : ''}>${answer[0].toUpperCase()+answer.slice(1)}</label>`).join('')}</fieldset>`).join('')}<label class="choice"><input type="checkbox" name="none_work" ${saved.none_work && saved.slots_revision === data.slots_revision ? 'checked' : ''}>None of these times work</label><p class="muted">Unanswered slots remain unanswered.</p>`;
  return `<form id="planning-form" data-kind="${escape(data.kind)}" data-method="${escape(data.vote_method)}" data-revision="${escape(data.slots_revision)}">${fields}<button type="submit">Save ${data.kind === 'vote' ? 'vote' : data.kind === 'time' ? 'availability' : 'response'}</button></form>`;
}

function googleCalendar(data) {
  const compact = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const params=new URLSearchParams({action:'TEMPLATE',text:data.title,dates:`${compact(data.starts_at)}/${compact(data.ends_at)}`,details:data.description || '',location:data.area_label || '',ctz:data.timezone || 'UTC'});
  return `https://calendar.google.com/calendar/render?${params}`;
}

function responseForm(data) {
  const disabled = data.state === 'full' && !['going', 'requested'].includes(data.response);
  return `<form id="response-form"><h2>Your response</h2><div class="responses"><button name="status" value="going" ${disabled ? 'disabled' : ''}>Going</button><button class="secondary" name="status" value="interested">Interested</button><button class="secondary" name="status" value="declined">Decline</button></div>${data.approval_required ? '<p class="muted">Going requires organizer approval.</p>' : ''}</form>`;
}

function verificationForm() {
  return `<form id="email-form"><h2>Join the plan</h2><p class="muted">Verify your email to respond. No app or password needed.</p><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required><button type="submit">Email a verification code</button></form>
<form id="verify-form" hidden><h2>Check your email</h2><label for="code">Verification code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required><label for="name">Your name</label><input id="name" name="name" autocomplete="given-name" maxlength="80" required><label for="birth">Date of birth</label><input id="birth" name="birth" type="date" autocomplete="bday" required><p class="muted">Squad Beacon is for ages 16 and older. Your birth date is never shown on the invitation.</p><button type="submit">Verify and continue</button><button class="quiet" type="button" id="change-email">Use another email</button></form>`;
}

const styles = `:root{color-scheme:light;--bg:#FAFAFB;--ink:#181A1F;--muted:#666973;--line:#E4E5E8;--primary:#343A40}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,sans-serif}main{max-width:640px;padding:32px 20px 44px;margin:auto}header{display:flex;align-items:center;gap:10px;font-weight:700;margin:0 0 28px}.mark{font-size:28px}article{background:white;border:1px solid var(--line);border-radius:28px;padding:32px;box-shadow:0 12px 44px #181a1f06}.eyebrow{text-transform:uppercase;letter-spacing:.1em;font-size:12px;font-weight:750;color:var(--muted)}h1{font-size:clamp(28px,7vw,42px);line-height:1.15;letter-spacing:-.035em;margin:16px 0 24px;overflow-wrap:anywhere}h2{font-size:21px;line-height:1.3}.description{white-space:pre-wrap;overflow-wrap:anywhere}.time{font-weight:600}.muted,.privacy{color:var(--muted);font-size:14px}.privacy{padding:0 12px}section{border-top:1px solid var(--line);margin-top:28px;padding-top:12px}label{display:block;font-weight:600;font-size:14px;margin:16px 0 6px}input{width:100%;min-height:48px;border:1px solid #8b8f98;border-radius:12px;padding:10px 12px;font:inherit;background:white;color:var(--ink)}button,.secondary{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 18px;border-radius:14px;font:600 15px/1.4 system-ui;cursor:pointer;text-decoration:none;border:1px solid var(--primary);background:var(--primary);color:white}form>button{margin-top:18px;width:100%}.secondary{background:white;color:var(--primary);border-color:var(--line)}.responses{display:flex;flex-wrap:wrap;gap:8px}.responses button{flex:1}.quiet{display:inline-block;border:0;background:none;color:var(--muted);font:inherit;font-size:14px;padding:12px 0;cursor:pointer}.confirmation{background:#F0F1F3;padding:14px 16px;border-radius:14px;font-weight:600}footer{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}footer .quiet{flex-basis:100%}button:disabled{opacity:.55;cursor:default}:focus-visible{outline:3px solid #236F8D;outline-offset:3px}[hidden]{display:none!important}#feedback{white-space:pre-wrap}#feedback[data-error=true]{color:#A73545}@media(max-width:420px){main{padding:22px 14px}article{padding:24px 20px;border-radius:22px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`;

const planningStyles = `fieldset{min-width:0;border:1px solid var(--line);border-radius:16px;margin:18px 0;padding:14px}legend{font-weight:650;padding:0 6px}.choice{display:flex;align-items:center;flex-wrap:wrap;gap:10px;min-height:48px;font-weight:500}.choice input{width:20px;min-height:20px;height:20px;accent-color:var(--primary)}.choice .muted{flex-basis:100%;margin-left:30px}select{width:100%;min-height:48px;font:inherit;border:1px solid #8b8f98;border-radius:12px;padding:10px;background:white;color:var(--ink)}.stops{padding-left:20px}.stops li{padding:10px 0 24px;border-bottom:1px solid var(--line)}blockquote{white-space:pre-wrap;margin:20px 0}`;

function ics(data) {
  if (data.kind !== 'beacon' || data.state === 'unavailable' || !data.calendar_id || !data.starts_at || !data.ends_at) return null;
  const date = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const text = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r/g, '');
  // RFC 5545 folds by UTF-8 octets, never through a multibyte character.
  const fold = line => { const lines = []; let part = ''; let size = 0; for (const c of line) { const n = Buffer.byteLength(c); if (size + n > 75) { lines.push(part); part = ' '; size = 1; } part += c; size += n; } return [...lines, part].join('\r\n'); };
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Squad Beacon//Connections//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${data.calendar_id}@squadbeacon`,`DTSTAMP:${date(new Date())}`,`DTSTART:${date(data.starts_at)}`,`DTEND:${date(data.ends_at)}`,`SUMMARY:${text(data.title)}`,`DESCRIPTION:${text(data.description)}`,`LOCATION:${text(data.area_label)}`,`STATUS:${data.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

async function card(data, url, flyer = false) {
  const available = data.state !== 'unavailable';
  const title = available ? String(data.title).slice(0, 70) : 'Invitation unavailable';
  const qr = flyer && available ? await QRCode.toString(url, { type: 'svg', margin: 4, errorCorrectionLevel: 'M' }) : '';
  const width = flyer ? 22 : 32;
  const lines = title.match(new RegExp(`.{1,${width}}(?:\\s|$)|.{1,${width}}`, 'g')) || [title];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" rx="32" fill="#FAFAFB"/><rect x="24" y="24" width="1152" height="582" rx="28" fill="#343A40"/><g fill="#fff" font-family="system-ui,sans-serif"><circle cx="83" cy="95" r="10" fill="none" stroke="#fff" stroke-width="2"/><circle cx="83" cy="95" r="5"/><text x="105" y="105" font-size="27">Squad Beacon</text>${lines.slice(0,3).map((line,i) => `<text x="72" y="${220+i*66}" font-size="52" font-weight="700">${escape(line.trim())}</text>`).join('')}<text x="72" y="535" font-size="24">${escape(flyer ? 'Scan to view your invitation' : 'Make plans. Show up together.')}</text></g>${qr ? `<svg x="845" y="185" width="260" height="260" viewBox="0 0 ${QRCode.create(url).modules.size+8} ${QRCode.create(url).modules.size+8}">${qr.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '')}</svg>` : ''}</svg>`;
}

module.exports = { escape, hashToken, newToken, tokenPattern, safePath, unavailable, renderPage, ics, card };
