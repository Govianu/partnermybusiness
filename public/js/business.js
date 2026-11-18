(async function () {
  const user = await guard('business');
  if (!user) return;
  const bizName = user.business?.businessName || user.name;
  fillWho(user, bizName);
  document.getElementById('hello').textContent = `Hello, ${user.name.split(' ')[0]}`;
  document.getElementById('statusLine').textContent =
    user.status === 'approved' ? `${bizName} is live on the network.` : `${bizName} is being reviewed by the PMB team. You can explore everything meanwhile.`;
  document.getElementById('bookingLink').href = `/book.html?h=${encodeURIComponent(user.handle)}`;

  let state = { opportunities: [], bookings: [], stats: {}, meetConfigured: false };

  async function load() {
    state = await api('/business/dashboard');
    render();
  }

  function render() {
    const s = state.stats;
    document.getElementById('stats').innerHTML = `
      <div class="stat"><div class="v">${s.pending}</div><div class="k">requests waiting</div></div>
      <div class="stat"><div class="v">${s.accepted}</div><div class="k">accepted bookings</div></div>
      <div class="stat"><div class="v">${inr(s.yourShare)}</div><div class="k">your share so far</div></div>
      <div class="stat"><div class="v">${inr(s.potentialMonthly)}</div><div class="k">possible extra / month</div></div>`;
    setCount('bookings', s.pending);

    const pending = state.bookings.filter(b => b.status === 'requested');
    document.getElementById('pendingList').innerHTML = pending.length
      ? `<div class="list">${pending.map(bookingItem).join('')}</div>`
      : `<div class="list"><div class="empty"><strong>No requests right now</strong>Share your booking page with event managers to start getting requests.</div></div>`;

    document.getElementById('bookingList').innerHTML = state.bookings.length
      ? `<div class="list">${state.bookings.map(bookingItem).join('')}</div>`
      : `<div class="list"><div class="empty"><strong>No bookings yet</strong>Requests appear here as soon as someone books through your page.</div></div>`;

    document.getElementById('opps').innerHTML = state.opportunities.length
      ? state.opportunities.map(oppCard).join('')
      : `<div class="panel empty"><strong>Ideas are being prepared</strong>Refresh in a minute, or tap “Suggest new ideas”.</div>`;
  }

  function oppCard(o) {
    return `<article class="opp">
      <h3>${esc(o.title)}</h3>
      <div class="earn">${inr(o.estMonthly)} <small>estimated extra per month</small></div>
      <div class="asset">${esc(o.idleAsset)}</div>
      <p>${esc(o.pitch)}</p>
      ${o.videoUrl ? `<a href="${esc(o.videoUrl)}" target="_blank" rel="noopener">Watch the 30-second pitch</a>` : ''}
      ${o.videoScript ? `<details><summary>30-second pitch script</summary><pre>${esc(o.videoScript)}</pre></details>` : ''}
      <div class="actions">
        ${o.status === 'interested'
          ? `<span class="pill approved">Your manager will call you</span>`
          : `<button class="btn small" data-opp="${o._id}" data-status="interested">I’m interested</button>
             <button class="btn ghost small" data-opp="${o._id}" data-status="dismissed">Not for me</button>`}
      </div>
    </article>`;
  }

  function bookingItem(b) {
    const share = b.split.lines.find(l => l.party === 'business');
    let action = '';
    if (b.status === 'requested') {
      action = `<div class="accept-row">
        <label class="check"><input type="checkbox" data-agree="${b._id}">
          I agree to host this booking under the PMB partner terms, with ${esc(b.split.modelLabel.toLowerCase())}.</label>
      </div>
      <div class="accept-row">
        <button class="btn" data-accept="${b._id}">Accept booking</button>
        <button class="btn warn small" data-decline="${b._id}">Decline</button>
      </div>`;
    } else if (b.status === 'accepted') {
      action = b.meetLink
        ? `<p><a class="btn small" href="${esc(b.meetLink)}" target="_blank" rel="noopener">Join onboarding call on Google Meet</a></p>`
        : `<p class="meta">Accepted on ${fmtDate(b.agreementAcceptedAt)}. Your PMB manager will send the onboarding call link.</p>`;
    }
    return `<div class="item">
      <div class="item-top">
        <span class="item-title">${esc(b.eventType)} for ${esc(b.requesterName)}</span>
        ${pill(b.status)}
      </div>
      <div class="meta">${fmtDate(b.eventDate)}${b.guests ? `, ${b.guests} guests` : ''}${b.leadGenName ? `, via ${esc(b.leadGenName)}` : ''}</div>
      ${b.message ? `<p class="item-body">${esc(b.message)}</p>` : ''}
      ${b.amount > 0 ? `<div class="meta" style="margin-top:.6rem">Booking value ${inr(b.amount)}. You receive ${inr(share?.amountInr)}.</div>${splitHtml(b.split, 'business')}` : ''}
      ${action}
    </div>`;
  }

  document.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    try {
      if (t.dataset.opp) {
        t.disabled = true;
        await api(`/business/opportunities/${t.dataset.opp}`, { method: 'PATCH', body: { status: t.dataset.status } });
        toast(t.dataset.status === 'interested' ? 'Sent to your PMB manager' : 'Idea hidden');
        await load();
      } else if (t.dataset.accept) {
        const box = t.closest('.item').querySelector(`[data-agree="${t.dataset.accept}"]`); // the box beside this button, not the copy on another tab
        if (!box?.checked) { toast('Tick the agreement to accept this booking', true); box?.focus(); return; }
        t.disabled = true;
        const { booking } = await api(`/business/bookings/${t.dataset.accept}/accept`, { method: 'POST', body: { agreementAccepted: true } });
        toast(booking.meetLink ? 'Booking accepted. Onboarding call scheduled.' : 'Booking accepted');
        await load();
      } else if (t.dataset.decline) {
        if (!confirm('Decline this booking request?')) return;
        await api(`/business/bookings/${t.dataset.decline}/decline`, { method: 'POST' });
        toast('Booking declined');
        await load();
      }
    } catch (err) {
      toast(err.message, true);
      t.disabled = false;
    }
  });

  document.getElementById('refreshOpps').addEventListener('click', async e => {
    e.target.disabled = true;
    e.target.textContent = 'Thinking…';
    try { await api('/business/opportunities/refresh', { method: 'POST' }); await load(); toast('New ideas added'); }
    catch (err) { toast(err.message, true); }
    finally { e.target.disabled = false; e.target.textContent = 'Suggest new ideas'; }
  });

  // ---------- Supply savings calculator ----------
  const rows = document.getElementById('calcRows');
  function addRow(v = {}) {
    const div = document.createElement('div');
    div.className = 'calc-row';
    div.innerHTML = `
      <div><label>Item</label><input data-k="item" value="${esc(v.item || '')}" placeholder="Milk"></div>
      <div><label>Daily quantity</label><input data-k="qty" type="number" min="0" value="${v.qty ?? ''}"></div>
      <div><label>Unit</label><input data-k="unit" value="${esc(v.unit || '')}" placeholder="L"></div>
      <div><label>Price now (₹)</label><input data-k="now" type="number" min="0" step="0.01" value="${v.now ?? ''}"></div>
      <div><label>Direct price (₹)</label><input data-k="direct" type="number" min="0" step="0.01" value="${v.direct ?? ''}"></div>
      <div class="save" data-out>₹0 / month</div>
      <button class="btn ghost small" type="button" aria-label="Remove item" data-remove>Remove</button>`;
    rows.appendChild(div);
    calc();
  }
  function calc() {
    let total = 0;
    rows.querySelectorAll('.calc-row').forEach(r => {
      const g = k => Number(r.querySelector(`[data-k="${k}"]`).value) || 0;
      const monthly = Math.max(0, (g('now') - g('direct')) * g('qty') * 30);
      r.querySelector('[data-out]').textContent = `${inr(monthly)} / month`;
      total += monthly;
    });
    document.getElementById('calcTotal').innerHTML = `${inr(total)}<small>saved per month</small>`;
    document.getElementById('calcYear').textContent = `That’s ${inr(total * 12)} a year, before any new income from bookings.`;
  }
  rows.addEventListener('input', calc);
  rows.addEventListener('click', e => { if (e.target.dataset.remove !== undefined) { e.target.closest('.calc-row').remove(); calc(); } });
  document.getElementById('addRow').addEventListener('click', () => addRow());
  addRow({ item: 'Milk (direct from dairy)', qty: 1000, unit: 'L', now: 46, direct: 44 });

  // ---------- Profile ----------
  const pf = document.getElementById('profileForm');
  pf.phone.value = user.phone || '';
  pf.address.value = user.business?.address || '';
  pf.idleSlots.value = user.business?.idleSlots || '';
  pf.razorpayAccountId.value = user.business?.razorpayAccountId || '';
  onSubmit(pf, async data => { await api('/business/profile', { method: 'PATCH', body: data }); toast('Profile saved'); });

  const m = user.assignedManager;
  document.getElementById('managerBox').innerHTML = m
    ? `<strong style="color:var(--ink)">${esc(m.name)}</strong><br>${esc(m.phone || '')}<br>${esc(m.email || '')}`
    : 'A PMB manager will be assigned once your profile is reviewed.';
  document.getElementById('sopList').innerHTML = (user.business?.sops || []).map(s => `<li>${esc(s)}</li>`).join('') || '<li>Added after review</li>';

  initViews();
  await load();
})();
