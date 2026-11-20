/* The CTA in the business and professional dashboards: the person's own CTA, the cost-saving vertical, the
   business type's videos and creatives (team research, link-shared from Google Drive), and, for professionals,
   financial planning. Data comes from /api/growth/my-cta. */
(function () {
  let cache = null;
  const load = () => (cache = cache || api('/growth/my-cta'));
  const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

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

  const PITCH = 'Having the idea is easy. Making it work is hard: you need a partner you can trust, a fair deal, customers and payments on time. We do all of that for you. You just say yes.';

  // A slide deck like the homepage one: one idea per slide, arrows, dots, keyboard, a button on each slide
  function deck(el, slides, label) {
    let at = 0;
    el.innerHTML = `<div class="ddeck" tabindex="0" role="region" aria-roledescription="slides" aria-label="${esc(label)}">
      <div class="ddeck-stage"></div>
      <div class="ddeck-nav"><button class="ddeck-arrow" type="button" aria-label="Previous slide">‹</button>
        <div class="ddeck-dots">${slides.map((s, i) => `<button class="ddeck-dot" type="button" aria-label="Slide ${i + 1}: ${esc(s.title)}" data-i="${i}"></button>`).join('')}</div>
        <span class="ddeck-count"></span><button class="ddeck-arrow" type="button" aria-label="Next slide">›</button></div></div>`;
    const root = el.querySelector('.ddeck'), stage = el.querySelector('.ddeck-stage');
    function show(i) {
      at = (i + slides.length) % slides.length;
      const s = slides[at];
      const media = s.video ? `<div class="ddeck-media ddeck-video"><iframe src="${esc(s.video.url)}" title="${esc(s.video.title || s.title)}" allow="autoplay" loading="lazy" allowfullscreen></iframe></div>`
        : s.img ? `<img class="ddeck-media" src="${esc(s.img.thumb)}" alt="${esc(s.title)}" onerror="this.remove()">` : '';
      stage.innerHTML = `<div class="ddeck-slide ${s.kind ? 'ddeck-' + s.kind : ''} ${media ? 'has-media' : ''}">
        <div class="ddeck-text"><span class="ddeck-kicker">${esc(s.kicker)}</span><h3 class="ddeck-title">${esc(s.title)}</h3>
          ${s.body ? `<p class="ddeck-body">${esc(s.body)}</p>` : ''}
          ${(s.facts || []).length ? `<ul class="ddeck-facts">${s.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          ${s.button ? `<button class="btn btn-gold" type="button" data-slide-go>${esc(s.button)}</button>` : ''}</div>${media}</div>`;
      const go = stage.querySelector('[data-slide-go]');
      if (go && s.onClick) go.addEventListener('click', s.onClick);
      el.querySelectorAll('.ddeck-dot').forEach((d, k) => d.setAttribute('aria-current', String(k === at)));
      el.querySelector('.ddeck-count').textContent = `${at + 1} / ${slides.length}`;
    }
    const [prev, next] = el.querySelectorAll('.ddeck-arrow');
    prev.onclick = () => show(at - 1); next.onclick = () => show(at + 1);
    el.querySelector('.ddeck-dots').onclick = e => { const d = e.target.closest('[data-i]'); if (d) show(Number(d.dataset.i)); };
    root.onkeydown = e => { if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1); };
    show(0);
  }
  const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const imgFor = (imgs, words) => imgs.find(i => words.some(w => w && (norm(i.title) === norm(w) || norm(i.title).includes(norm(w)))));

  // 5 different ways to earn, the same as in their welcome email and on the homepage, as slides
  async function renderWays(el, ctx) {
    if (!el) return;
    try {
      const { ways, about, media } = await load();
      if (!ways || !ways.length) { el.innerHTML = ''; return; }
      const inr = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
      const imgs = media?.images || [];
      const talk = topic => () => Growth.openCtaDialog(ctx, { action: 'launch_idea', topic });
      const slides = [{ kind: 'intro', kicker: 'Earn more', title: about?.text ? 'What we found about you' : '5 ways to earn more',
        body: about?.text || 'Five different ways to earn more, one per slide. Press the arrows to see each one.',
        facts: [about?.busy && `Busy: ${about.busy}`, about?.quiet && `Quiet: ${about.quiet}`].filter(Boolean),
        video: media?.video || null, button: 'Talk to my PMB manager', onClick: talk('Ways to earn more') }]
        .concat(ways.map((w, i) => ({ kind: 'way', kicker: `Way ${i + 1} of ${ways.length}`, title: w.title, body: w.line,
          facts: [w.examples.length && `For example: ${w.examples.join(', ')}.`, w.estMonthly && `About ${inr(w.estMonthly)} a month`].filter(Boolean),
          img: imgFor(imgs, w.examples || []), button: 'I want this', onClick: talk(w.title) })))
        .concat([{ kind: 'close', kicker: 'Next step', title: 'Ready to start?', body: PITCH, button: 'Talk to my PMB manager', onClick: talk('Ways to earn more') }]);
      el.innerHTML = '<div class="section-title"><h2>5 ways to earn more</h2></div><div data-deck></div>';
      deck(el.querySelector('[data-deck]'), slides, '5 ways to earn more');
    } catch (e) { el.innerHTML = `<p class="error-box">${esc(e.message)}</p>`; }
  }

  // Where their money goes and 5 ways we cut it, as slides (same as the homepage and the email), with the video
  async function renderSavings(el, ctx) {
    if (!el) return;
    try {
      const { savings: s, media } = await load();
      if (!s) { el.innerHTML = ''; return; }
      const plan = topic => () => Growth.openCtaDialog(ctx, { action: 'save_costs', topic });
      const slides = [{ kind: 'save-intro', kicker: 'Spend less', title: 'Where your money goes',
        body: `Your biggest costs each month: ${s.topCosts.join(', ')}.`, facts: ['Next: 5 ways we cut them, one per slide.'],
        video: media?.video || null, button: 'Get my savings plan', onClick: plan('Cost-saving plan') }]
        .concat(s.levers.map((l, i) => ({ kind: 'save', kicker: `Save ${i + 1} of ${s.levers.length}${l.cost ? ': ' + l.cost.toLowerCase() : ''}`,
          title: l.title, body: l.we || '', facts: [l.leak && `Where the money goes: ${l.leak}`, `Save ${l.saving}.`].filter(Boolean),
          img: imgFor(media?.images || [], [l.cost, l.title]), button: 'Save on this', onClick: plan(`Saving: ${l.title}`) })))
        .concat([{ kind: 'close', kicker: 'Example', title: 'What it can add up to', body: s.example,
          facts: ['These numbers are only examples. Send us your 5 biggest monthly bills and we will show you what you can really save. We find the suppliers and partners and set it all up.'],
          button: 'Get my savings plan', onClick: plan('Cost-saving plan') }]);
      el.innerHTML = '<div data-deck></div>';
      deck(el.querySelector('[data-deck]'), slides, 'Ways to save');
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
    renderMyCta(document.getElementById('myCta'));
    renderWays(document.getElementById('waysBox'), ctx);
    renderSavings(document.getElementById('savingsBox'), ctx);
    renderMedia(document.getElementById('mediaBox'));
    if (ctx.isPro) renderFinance(document.getElementById('financeBox'), ctx);
  }

  window.CtaDash = { mount };
})();
