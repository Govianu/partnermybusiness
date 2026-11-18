(async function () {
  const user = await guard('admin');
  if (!user) return;
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoStatus').outerHTML = pill('approved');

  let admins = [];
  let stages = ['new', 'contacted', 'meeting', 'cta_sent', 'signed', 'lost'];

  // ---------- Overview ----------
  async function loadOverview() {
    const o = await api('/admin/overview');
    document.getElementById('todayLine').textContent =
      `${o.importedToday} of ${o.importTarget} profiles imported today.`;
    document.getElementById('stats').innerHTML = `
      <div class="stat"><div class="v">${o.importedToday}/${o.importTarget}</div><div class="k">imported today</div></div>
      <div class="stat"><div class="v">${o.pendingProfiles}</div><div class="k">profiles to review</div></div>
      <div class="stat"><div class="v">${o.pendingMedia}</div><div class="k">uploads to validate</div></div>
      <div class="stat"><div class="v">${o.requestedBookings}</div><div class="k">bookings awaiting venue</div></div>
      <div class="stat"><div class="v">${o.proposedWorkshops}</div><div class="k">workshops to approve</div></div>
      <div class="stat"><div class="v">${(o.users.business || 0)} / ${(o.users.associate || 0)}</div><div class="k">businesses / associates</div></div>`;
    document.getElementById('pipeline').innerHTML = stages
      .map(s => `<div class="stat"><div class="v">${o.leads[s] || 0}</div><div class="k">${pretty(s)}</div></div>`).join('');
    setCount('validation', o.pendingMedia);
    setCount('profiles', o.pendingProfiles);
  }

  // ---------- Website enquiries ----------
  async function loadEnquiries() {
    const { enquiries } = await api('/admin/enquiries');
    const mail = st => ({ sent: 'sent', outbox: 'saved to outbox', failed: 'failed' }[st] || '—');
    document.getElementById('enquiryRows').innerHTML = enquiries.length ? enquiries.map(e => `<tr>
      <td><strong>${esc(e.name)}</strong>${e.business ? `<div class="meta">${esc(e.business)}</div>` : ''}<div class="meta">${esc(e.email)}<br>${esc(e.phone || '')}</div></td>
      <td>${esc(e.roleName || e.role)}<div class="meta">${esc([e.businessType, e.location].filter(Boolean).join(', '))}</div>${e.message ? `<div class="meta">${esc(e.message.slice(0, 140))}</div>` : ''}</td>
      <td>${new Date(e.termsAcceptedAt).toLocaleString('en-IN')}<div class="meta">Version ${esc(e.termsVersion)}<br>IP ${esc(e.ip || '—')}</div></td>
      <td class="meta">To them: ${mail(e.emailStatus?.person)}<br>To team: ${mail(e.emailStatus?.team)}</td>
      <td>${e.user?.handle ? `<code class="handle">${handleHtml(e.user.handle)}</code><div>${pill(e.user.status)}</div>` : '<span class="meta">Team follow-up</span>'}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty"><strong>No enquiries yet</strong>Enquiries from the homepage appear here.</td></tr>';
  }

  // ---------- Import ----------
  onSubmit(document.getElementById('importForm'), async (data, form) => {
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Importing…';
    try {
      const { results } = await api('/admin/import/bulk', { method: 'POST', body: data });
      document.getElementById('importResults').innerHTML = results.map(r => `<div class="item">
        ${r.ok
          ? `<div class="item-top"><code class="handle">${handleHtml(r.handle)}</code><span class="pill ${r.duplicate ? 'pending' : 'approved'}">${r.duplicate ? 'already imported' : 'created'}</span></div>`
          : `<div class="item-top"><span class="meta" style="word-break:break-all">${esc(r.mapsUrl)}</span><span class="pill rejected">failed</span></div><div class="meta">${esc(r.error)}</div>`}
      </div>`).join('');
      const ok = results.filter(r => r.ok && !r.duplicate).length;
      toast(`${ok} profile${ok === 1 ? '' : 's'} created`);
      form.links.value = '';
      loadOverview();
    } finally {
      btn.textContent = 'Import profiles';
    }
  });

  // ---------- Validation ----------
  async function loadMedia() {
    const { media } = await api('/admin/media?status=pending');
    const kinds = { intro_video: 'Intro video', training_video: 'Training video', course_pdf: 'Course PDF' };
    document.getElementById('mediaQueue').innerHTML = media.length
      ? `<div class="list">${media.map(m => `<div class="item">
          <div class="item-top"><a class="item-title" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a><span class="meta">${kinds[m.kind]}</span></div>
          <div class="meta"><code class="handle">${handleHtml(m.owner?.handle)}</code>, sent ${fmtDate(m.createdAt)}</div>
          ${m.description ? `<p class="item-body">${esc(m.description)}</p>` : ''}
          <div class="accept-row">
            <input placeholder="Note for the associate (needed to reject)" data-note="${m._id}" style="max-width:420px">
            <button class="btn small" data-review="${m._id}" data-decision="approved">Approve</button>
            <button class="btn warn small" data-review="${m._id}" data-decision="rejected">Reject</button>
          </div>
        </div>`).join('')}</div>`
      : '<div class="list"><div class="empty"><strong>Queue is clear</strong>New uploads from associates will appear here.</div></div>';
  }

  // ---------- Leads ----------
  const stageFilter = document.getElementById('stageFilter');
  async function loadLeads() {
    const q = stageFilter.value ? `?stage=${stageFilter.value}` : '';
    const d = await api('/admin/leads' + q);
    stages = d.stages;
    if (stageFilter.options.length === 1) stageFilter.innerHTML += stages.map(s => `<option value="${s}">${pretty(s)}</option>`).join('');
    document.getElementById('leadRows').innerHTML = d.leads.length
      ? d.leads.map(l => {
          const last = l.history[l.history.length - 1] || {};
          return `<tr>
            <td><strong>${esc(l.name)}</strong>${l.company ? `<div class="meta">${esc(l.company)}</div>` : ''}<div class="meta">${esc(l.phone || '')} ${esc(l.email || '')}</div>
              ${l.relatedUser?.handle ? `<code class="handle">${handleHtml(l.relatedUser.handle)}</code>` : ''}</td>
            <td>${esc(l.source)}</td>
            <td>${pill(l.stage)}</td>
            <td><div class="meta">${fmtDate(last.at)}${l.owner ? `, ${esc(l.owner.name)}` : ''}</div>
              ${last.note ? `<div>${esc(last.note)}</div>` : ''}
              ${last.proofUrl && /^https?:/.test(last.proofUrl) ? `<a href="${esc(last.proofUrl)}" target="_blank" rel="noopener">Proof</a>` : ''}</td>
            <td style="min-width:230px">
              <select data-stage-for="${l._id}">${stages.map(s => `<option value="${s}" ${s === l.stage ? 'selected' : ''}>${pretty(s)}</option>`).join('')}</select>
              <input data-proof-for="${l._id}" placeholder="Proof link" style="margin-top:.35rem">
              <input data-note-for="${l._id}" placeholder="Note" style="margin-top:.35rem">
              <button class="btn small" data-move="${l._id}" style="margin-top:.35rem">Update stage</button>
            </td></tr>`;
        }).join('')
      : '<tr><td colspan="5" class="empty"><strong>No leads here</strong>Imports and booking requests create leads automatically.</td></tr>';
  }
  stageFilter.addEventListener('change', loadLeads);
  onSubmit(document.getElementById('leadForm'), async (data, form) => {
    await api('/admin/leads', { method: 'POST', body: data });
    form.reset(); toast('Lead added'); loadLeads();
  });

  // ---------- Profiles ----------
  let searchTimer;
  async function loadUsers() {
    const p = new URLSearchParams();
    const r = document.getElementById('roleFilter').value;
    const s = document.getElementById('statusFilter').value;
    const q = document.getElementById('userSearch').value.trim();
    if (r) p.set('role', r); else p.set('role', '');
    if (s) p.set('status', s);
    if (q) p.set('q', q);
    const d = await api('/admin/users?' + [...p].filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'));
    admins = d.admins;
    document.getElementById('userRows').innerHTML = d.users.filter(u => u.role !== 'admin').map(u => `<tr>
      <td><code class="handle">${handleHtml(u.handle)}</code><div class="meta">${pretty(u.role)}</div></td>
      <td>${esc(u.role === 'business' ? u.business?.businessName : u.name)}${u.business?.mapsUrl ? `<div><a href="${esc(u.business.mapsUrl)}" target="_blank" rel="noopener">Maps</a></div>` : ''}</td>
      <td class="meta">${esc(u.email || 'Not claimed yet')}<br>${esc(u.phone || '')}</td>
      <td><select data-user-status="${u._id}">${['pending', 'imported', 'approved', 'rejected'].map(x => `<option ${x === u.status ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
      <td><select data-user-manager="${u._id}"><option value="">Unassigned</option>${admins.map(a => `<option value="${a._id}" ${u.assignedManager?._id === a._id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty"><strong>No profiles match</strong>Try another filter.</td></tr>';
  }
  ['roleFilter', 'statusFilter'].forEach(id => document.getElementById(id).addEventListener('change', loadUsers));
  document.getElementById('userSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadUsers, 300); });

  // ---------- Gigs ----------
  async function loadGigs() {
    const { gigs } = await api('/admin/gigs');
    document.getElementById('gigRows').innerHTML = gigs.map(g => `<tr>
      <td><strong>${esc(g.title)}</strong><div class="meta">${g.type === 'workshop' ? `Workshop by ${esc(g.host?.name || '')}` : `Shift for ${pretty(g.category)}`}</div></td>
      <td>${esc(g.venue?.business?.businessName || g.location || '—')}<div class="meta">${fmtDate(g.date)}</div></td>
      <td>${g.type === 'workshop' ? `${inr(g.pricePerSeat)} × ${g.seats} seats<div class="meta">${inr(g.pricePerSeat * g.seats)} potential</div>` : `${inr(g.pay)} per shift`}</td>
      <td>${g.type === 'shift' ? `${g.applicants.length}/${g.slots} applied<div class="meta">${g.applicants.map(a => esc(a.name)).join(', ')}</div>` : '—'}</td>
      <td><select data-gig-status="${g._id}">${['proposed', 'open', 'filled', 'closed', 'cancelled'].map(x => `<option ${x === g.status ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty"><strong>No gigs yet</strong>Post a shift above.</td></tr>';
  }
  onSubmit(document.getElementById('gigForm'), async (data, form) => {
    await api('/admin/gigs', { method: 'POST', body: data });
    form.reset(); toast('Shift posted'); loadGigs();
  });

  // ---------- Bookings ----------
  async function loadBookings() {
    const { bookings } = await api('/admin/bookings');
    if (!bookings.length) {
      document.getElementById('bookingList').innerHTML = '<div class="list"><div class="empty"><strong>No bookings yet</strong>Bookings arrive through each venue’s booking page.</div></div>';
      return;
    }
    const items = await Promise.all(bookings.map(async b => {
      const split = await api('/payments/split-preview', { method: 'POST', body: { amount: b.amount, model: b.splitModel, partnerShare: b.partnerShare } });
      return `<div class="item">
        <div class="item-top"><span class="item-title">${esc(b.eventType)} at ${esc(b.business?.business?.businessName || '')}</span>${pill(b.status)}</div>
        <div class="meta">${esc(b.requesterName)}${b.leadGenName ? ` via ${esc(b.leadGenName)}` : ''}, ${fmtDate(b.eventDate)}${b.payment?.orderId ? `, order ${esc(b.payment.orderId)}` : ''}</div>
        <div class="accept-row">
          <label style="margin:0">Amount <input type="number" min="0" value="${b.amount}" data-b-amount="${b._id}" style="width:130px"></label>
          <label style="margin:0">Model
            <select data-b-model="${b._id}" style="width:auto">
              <option value="four_way" ${b.splitModel === 'four_way' ? 'selected' : ''}>4-way 25% each</option>
              <option value="infra_first" ${b.splitModel === 'infra_first' ? 'selected' : ''}>20% infra first</option>
            </select></label>
          <label style="margin:0">Partner % of remainder <input type="number" min="0" max="100" value="${b.partnerShare}" data-b-share="${b._id}" style="width:90px"></label>
          <button class="btn ghost small" data-b-save="${b._id}">Save split</button>
          ${b.status === 'accepted' ? `<button class="btn small" data-b-order="${b._id}">Create payment order</button>` : ''}
        </div>
        ${splitHtml(split)}
        <pre class="meta" data-b-out="${b._id}" hidden style="white-space:pre-wrap;background:var(--paper);padding:.7rem;border-radius:8px"></pre>
      </div>`;
    }));
    document.getElementById('bookingList').innerHTML = `<div class="list">${items.join('')}</div>`;
  }

  // ---------- Event delegation ----------
  document.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;
    try {
      if (t.dataset.review) {
        const note = document.querySelector(`[data-note="${t.dataset.review}"]`).value;
        await api(`/admin/media/${t.dataset.review}/review`, { method: 'POST', body: { decision: t.dataset.decision, note } });
        toast(t.dataset.decision === 'approved' ? 'Upload approved' : 'Upload rejected with note');
        loadMedia(); loadOverview();
      } else if (t.dataset.move) {
        const id = t.dataset.move;
        await api(`/admin/leads/${id}`, { method: 'PATCH', body: {
          stage: document.querySelector(`[data-stage-for="${id}"]`).value,
          proofUrl: document.querySelector(`[data-proof-for="${id}"]`).value,
          note: document.querySelector(`[data-note-for="${id}"]`).value
        } });
        toast('Lead updated'); loadLeads();
      } else if (t.dataset.bSave) {
        const id = t.dataset.bSave;
        await api(`/admin/bookings/${id}`, { method: 'PATCH', body: {
          amount: document.querySelector(`[data-b-amount="${id}"]`).value,
          splitModel: document.querySelector(`[data-b-model="${id}"]`).value,
          partnerShare: document.querySelector(`[data-b-share="${id}"]`).value
        } });
        toast('Split saved'); loadBookings();
      } else if (t.dataset.bOrder) {
        const id = t.dataset.bOrder;
        const r = await api(`/payments/orders/${id}`, { method: 'POST' });
        const out = document.querySelector(`[data-b-out="${id}"]`);
        out.hidden = false;
        out.textContent = r.dryRun
          ? `Razorpay keys are not set, so this is a dry run. This order would be created:\n${JSON.stringify(r.payload, null, 2)}${r.missing.length ? `\n\nMissing linked accounts: ${r.missing.join(', ')}` : ''}`
          : `Order ${r.order.id} created. Send the customer to checkout with this order ID.`;
      }
    } catch (err) {
      toast(err.message, true);
    }
  });

  document.addEventListener('change', async e => {
    const el = e.target;
    try {
      if (el.dataset.userStatus) {
        await api(`/admin/users/${el.dataset.userStatus}`, { method: 'PATCH', body: { status: el.value } });
        toast('Status updated'); loadOverview();
      } else if (el.dataset.userManager !== undefined && el.dataset.userManager) {
        await api(`/admin/users/${el.dataset.userManager}`, { method: 'PATCH', body: { assignedManager: el.value } });
        toast('Manager assigned');
      } else if (el.dataset.gigStatus) {
        await api(`/admin/gigs/${el.dataset.gigStatus}`, { method: 'PATCH', body: { status: el.value } });
        toast('Gig updated');
      }
    } catch (err) { toast(err.message, true); }
  });

  const loaders = { overview: loadOverview, enquiries: loadEnquiries, validation: loadMedia, leads: loadLeads, profiles: loadUsers, gigs: loadGigs, bookings: loadBookings };
  initViews(name => loaders[name] && loaders[name]().catch(err => toast(err.message, true)));
  loadOverview().catch(() => {});
})();
