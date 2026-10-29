/* Focused invitation client. No account token, guest identity ID or secret is read by JavaScript. */
(() => {
  const token = new URLSearchParams(location.search).get('token') || location.pathname.split('/')[2];
  const target = new URLSearchParams(location.search).get('target');
  const feedback = document.getElementById('feedback');
  let email = '';
  let pendingResponse = null;
  let busy = false;
  async function send(action, values = {}) {
    const response = await fetch('/api/guest', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-SB-Guest': '1' }, body: JSON.stringify({ action, token, ...(target ? {target} : {}), ...values }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save. Please try again.');
    return data;
  }
  async function submit(event, work) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    if (feedback) { feedback.textContent = ''; feedback.dataset.error = 'false'; }
    const buttons = Array.from(document.querySelectorAll('button'));
    const disabled = buttons.map(button => button.disabled);
    buttons.forEach(button => button.disabled = true);
    try { await work(); }
    catch (error) { if (feedback) { feedback.textContent = error.message; feedback.dataset.error = 'true'; } }
    finally { busy = false; buttons.forEach((button, index) => button.disabled = disabled[index]); }
  }
  const emailForm = document.getElementById('email-form');
  const verifyForm = document.getElementById('verify-form');
  emailForm?.addEventListener('submit', event => submit(event, async () => {
    email = new FormData(emailForm).get('email').trim();
    await send('send-code', { email });
    emailForm.hidden = true; verifyForm.hidden = false;
    document.getElementById('code').focus();
    feedback.textContent = 'If this email can receive invitations, a verification code is on its way.';
  }));
  document.getElementById('change-email')?.addEventListener('click', () => { verifyForm.hidden = true; emailForm.hidden = false; document.getElementById('email').focus(); });
  verifyForm?.addEventListener('submit', event => submit(event, async () => {
    const fields = Object.fromEntries(new FormData(verifyForm));
    await send('verify', { email, ...fields });
    location.reload();
  }));
  document.getElementById('response-form')?.addEventListener('submit', event => {
    const status = event.submitter?.value;
    if (!status) return;
    submit(event, async () => {
      if (!pendingResponse || pendingResponse.status !== status) pendingResponse = { status, request: crypto.randomUUID() };
      const result = await send('respond', { command: 'rsvp', payload: { status }, request: pendingResponse.request });
      pendingResponse = null;
      feedback.textContent = result.response === 'requested' ? 'Your request is waiting for organizer approval.' : 'Your response is saved.';
      location.reload();
    });
  });
  const planningForm = document.getElementById('planning-form');
  const availableAfter = document.getElementById('available-after');
  const pingResponse = document.getElementById('ping-response');
  if (availableAfter?.dataset.saved) {
    const date = new Date(availableAfter.dataset.saved);
    if (Number.isFinite(+date)) { const pad = value => String(value).padStart(2,'0'); availableAfter.value = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
  }
  const updatePing = () => { if (availableAfter) availableAfter.disabled = pingResponse?.value !== 'interested'; };
  pingResponse?.addEventListener('change',updatePing); updatePing();
  planningForm?.addEventListener('change',event=>{
    const none=planningForm.querySelector('[name="none_work"]');
    if (event.target === none && none.checked) {
      if (planningForm.dataset.kind === 'time') planningForm.querySelectorAll('input[type="radio"]').forEach(input=>input.checked=input.value === 'no');
      else planningForm.querySelectorAll('[name="proposal_ids"]').forEach(input=>input.checked=false);
    } else if (none) none.checked=false;
  });
  planningForm?.addEventListener('submit',event=>submit(event,async()=>{
    const fields=new FormData(planningForm),kind=planningForm.dataset.kind;
    let command,payload;
    if (kind === 'ping') { command='ping'; payload={response:fields.get('response'),available_after:fields.get('response') === 'interested' && fields.get('available_after') ? new Date(fields.get('available_after')).toISOString() : null}; }
    else if (kind === 'vote') {
      command='vote';payload=planningForm.dataset.method === 'approval' ? {proposal_ids:fields.getAll('proposal_ids'),none_work:fields.get('none_work') === 'on'} : {proposal_id:fields.get('proposal_id')};
      if ((!payload.proposal_ids?.length && !payload.none_work) && !payload.proposal_id) throw new Error('Choose an approved option or None work.');
    } else {
      command='availability';payload={slots_revision:Number(planningForm.dataset.revision),answers:Object.fromEntries([...fields].filter(([key])=>key.startsWith('slot:')).map(([key,value])=>[key.slice(5),value])),none_work:fields.get('none_work') === 'on'};
    }
    const fingerprint=JSON.stringify({command,payload});
    if (!pendingResponse || pendingResponse.fingerprint !== fingerprint) pendingResponse={fingerprint,request:crypto.randomUUID()};
    await send('respond',{command,payload,request:pendingResponse.request});pendingResponse=null;location.reload();
  }));
  document.getElementById('sign-out')?.addEventListener('click', event => submit(event, async () => { await send('sign-out'); location.reload(); }));
})();
