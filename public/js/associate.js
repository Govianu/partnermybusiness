(async function () {
  const user = await guard('associate');
  if (!user) return;
  fillWho(user, user.name);
  document.getElementById('hello').textContent = `Hello, ${user.name.split(' ')[0]}`;

  async function load() {
    const d = await api('/associate/dashboard');

    document.getElementById('steps').innerHTML = d.steps
      .map(s => `<li class="${s.done ? 'done' : ''}"><strong>${esc(s.label)}</strong><div class="meta">${s.done ? 'Done' : 'To do'}</div></li>`)
      .join('');

    const m = d.user.assignedManager;
    document.getElementById('managerBox').innerHTML = m
      ? `<strong style="color:var(--ink)">${esc(m.name)}</strong><br>${esc(m.phone || '')}<br>${esc(m.email || '')}`
      : 'A manager is assigned once the team reviews your profile.';

    document.getElementById('myGigs').innerHTML = d.myGigs.length
      ? d.myGigs.map(g => `<div style="margin-bottom:.7rem"><strong>${esc(g.title)}</strong> ${pill(g.status)}<div class="meta">${g.type === 'workshop' ? 'Your workshop' : 'Shift applied'}, ${fmtDate(g.date)}</div></div>`).join('')
      : '<p class="meta">Nothing yet. Apply for a shift or propose a workshop.</p>';

    document.getElementById('openGigs').innerHTML = d.openGigs.length
      ? `<div class="list">${d.openGigs.map(g => `<div class="item">
          <div class="item-top"><span class="item-title">${esc(g.title)}</span><strong>${g.type === 'shift' ? inr(g.pay) + ' per shift' : inr(g.pricePerSeat) + ' per seat'}</strong></div>
          <div class="meta">${esc(g.venue?.business?.businessName || g.location || 'Venue to be confirmed')}, ${fmtDate(g.date)}${g.durationHours ? `, ${g.durationHours} hours` : ''}</div>
          ${g.description ? `<p class="item-body">${esc(g.description)}</p>` : ''}
          ${g.type === 'shift' ? `<button class="btn small" data-apply="${g._id}">Apply for this shift</button>` : ''}
        </div>`).join('')}</div>`
      : `<div class="list"><div class="empty"><strong>No open shifts in ${esc(user.location)} right now</strong>New shifts are added by the PMB team every week.</div></div>`;

    const kinds = { intro_video: 'Intro video', training_video: 'Training video', course_pdf: 'Course PDF' };
    document.getElementById('mediaList').innerHTML = d.media.length
      ? `<div class="list">${d.media.map(x => `<div class="item">
          <div class="item-top"><a class="item-title" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>${pill(x.status)}</div>
          <div class="meta">${kinds[x.kind]}, uploaded ${fmtDate(x.createdAt)}</div>
          ${x.reviewNote ? `<p class="item-body"><strong>Team note:</strong> ${esc(x.reviewNote)}</p>` : ''}
        </div>`).join('')}</div>`
      : '<div class="list"><div class="empty"><strong>No uploads yet</strong>Start with a 30-second intro: who you are, what you cook or do, and your best skill.</div></div>';
  }

  document.addEventListener('click', async e => {
    const id = e.target.dataset?.apply;
    if (!id) return;
    e.target.disabled = true;
    try { await api(`/associate/gigs/${id}/apply`, { method: 'POST' }); toast('Applied. Your manager will confirm.'); await load(); }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  });

  onSubmit(document.getElementById('mediaForm'), async (data, form) => {
    await api('/associate/media', { method: 'POST', body: data });
    form.reset();
    toast('Uploaded. The team will review it.');
    await load();
  });

  const wf = document.getElementById('workshopForm');
  async function preview() {
    const amount = (Number(wf.pricePerSeat.value) || 0) * (Number(wf.seats.value) || 0);
    document.getElementById('wTotal').innerHTML = `${inr(amount)}<small>ticket revenue if every seat sells</small>`;
    try {
      const split = await api('/payments/split-preview', { method: 'POST', body: { amount, model: 'four_way' } });
      document.getElementById('wSplit').innerHTML = splitHtml(split);
    } catch { /* ignore preview errors */ }
  }
  wf.addEventListener('input', preview);
  onSubmit(wf, async (data, form) => {
    await api('/associate/gigs/workshop', { method: 'POST', body: data });
    form.reset();
    toast('Workshop sent for approval');
    preview();
    await load();
  });

  initViews();
  preview();
  await load();
})();
