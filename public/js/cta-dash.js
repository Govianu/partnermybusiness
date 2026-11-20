/* The CTA in the business and professional dashboards: the person's own CTA, the cost-saving vertical, the
   business type's videos and creatives (team research, link-shared from Google Drive), and, for professionals,
   financial planning. Data comes from /api/growth/my-cta. */
(function () {
  let cache = null;
  const load = () => (cache = cache || api('/growth/my-cta'));
  const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  // Lead ID beside the greeting on the overview
  function leadBadge(user) {
    if (!user.leadId) return;
    const hello = document.getElementById('hello');
    if (!hello || document.getElementById('leadBadge')) return;
    hello.insertAdjacentHTML('afterend', ` <code class="handle" id="leadBadge" title="Your Partnermybusiness lead ID">${esc(user.leadId)}</code>`);
  }

  async function renderMyCta(el) {
    if (!el) return;
    el.innerHTML = '<p class="meta">Loading your CTA…</p>';
    try {
      const d = await load();
      el.innerHTML = `<div class="cta-status">${d.agreed
        ? `<span class="pill approved">Agreed</span> <span class="meta">You agreed to this CTA online on ${fmtDate(d.agreed.at)} (terms version ${esc(d.agreed.version)}).</span>`
        : '<span class="pill pending">Not agreed yet</span>'}</div>
        <div class="cta-doc">${d.html}</div>`;   // built and escaped on the server (utils/cta.js)
    } catch (e) { el.innerHTML = `<p class="error-box">${esc(e.message)}</p>`; }
  }

  async function renderSavings(el, ctx) {
    if (!el) return;
    try {
      const { savings: s } = await load();
      if (!s) { el.innerHTML = ''; return; }
      el.innerHTML = `<p class="meta" style="margin:0 0 1rem">Top costs for ${esc(s.label.toLowerCase())}: ${esc(s.topCosts.join(', '))}. Partnership is collaboration, not competition: we match you with partners on both sides so costs come down.</p>
        <div class="save-grid">${s.levers.map((l, i) => `<article class="save-card">
          <span class="save-n">${i + 1}</span>
          <h3>${esc(l.title)}</h3>
          <p>${esc(l.how)}</p>
          <strong>${esc(l.saving)}</strong>
        </article>`).join('')}</div>
        <div class="save-example"><span>Example</span>${esc(s.example)} <span class="meta">Illustrative. We confirm your real numbers from your top 5 monthly expenses, quantities, rates and suppliers.</span></div>
        <button class="btn" type="button" data-save-plan>Get my savings plan</button>`;
      el.querySelector('[data-save-plan]').addEventListener('click', () => Growth.openCtaDialog(ctx, { action: 'save_costs', topic: 'Cost-saving plan' }));
    } catch (e) { el.innerHTML = `<p class="error-box">${esc(e.message)}</p>`; }
  }

  // The type's 30-second video and creatives (shown only when the team has made some for this type)
  async function renderMedia(el) {
    if (!el) return;
    try {
      const { media } = await load();
      const v = media?.video, imgs = media?.images || [];
      if (!v && !imgs.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = `<div class="section-title"><h2>See it in action</h2></div>
        <div class="media-row">
          ${v ? `<div class="media-video"><iframe src="${esc(v.url)}" title="${esc(v.title)}" allow="autoplay" loading="lazy" allowfullscreen></iframe></div>` : ''}
          ${imgs.length ? `<div class="media-slides">${imgs.map(i => `<a href="https://drive.google.com/file/d/${esc(i.id)}/view" target="_blank" rel="noopener" title="${esc(i.title)}">
            <img src="${esc(i.thumb)}" alt="${esc(i.title)}" loading="lazy" onerror="this.parentNode.remove()"></a>`).join('')}</div>` : ''}
        </div>`;
    } catch { el.hidden = true; }
  }

  // Professionals: steady work from PMB, then a line of credit from a bank on that basis
  function renderFinance(el, ctx) {
    if (!el) return;
    const start = Math.max(20000, Math.round(((ctx.sector.f || [])[1] || 60000) / 4 / 1000) * 1000);
    el.innerHTML = `<p class="meta" style="margin:0 0 1rem">When we bring you steady work, we can commit to it for six months. That steady income is what banks look for before giving you a line of credit, so you can buy equipment, a vehicle or stock.</p>
      <div class="fin-grid">
        <div class="panel">
          <label for="finMonthly">Monthly income from PMB work (₹)</label>
          <input id="finMonthly" type="number" min="0" step="1000" value="${start}">
          <label for="finMonths" style="margin-top:.8rem;display:block">Months we commit to</label>
          <select id="finMonths"><option>3</option><option selected>6</option><option>12</option></select>
          <div class="fin-out" id="finOut"></div>
        </div>
        <div class="panel">
          <h3 style="margin-top:0">How it works</h3>
          <ol class="fin-steps">
            <li>We bring you orders and commit to a steady monthly amount.</li>
            <li>We give you a work-commitment letter for the bank.</li>
            <li>You share your PAN, Aadhaar and six months of bank statements.</li>
            <li>The bank decides your line of credit. We help you apply.</li>
          </ol>
          <button class="btn" type="button" data-fin>Plan my finances</button>
        </div>
      </div>
      <p class="meta" style="margin-top:.8rem">Illustrative only. The bank decides any credit; we don’t lend money or promise approval.</p>`;
    const calc = () => {
      const m = Number(el.querySelector('#finMonthly').value) || 0, n = Number(el.querySelector('#finMonths').value) || 6;
      el.querySelector('#finOut').innerHTML = `<div><span>Committed income over ${n} months</span><b>${money(m * n)}</b></div>`;
    };
    el.addEventListener('input', calc); calc();
    el.querySelector('[data-fin]').addEventListener('click', () => Growth.openCtaDialog(ctx, { action: 'financial_plan', topic: `Financial planning: ${money(el.querySelector('#finMonthly').value)} a month` }));
  }

  function mount(ctx, user) {
    leadBadge(user);
    renderMyCta(document.getElementById('myCta'));
    renderSavings(document.getElementById('savingsBox'), ctx);
    renderMedia(document.getElementById('mediaBox'));
    if (ctx.isPro) renderFinance(document.getElementById('financeBox'), ctx);
  }

  window.CtaDash = { mount };
})();
