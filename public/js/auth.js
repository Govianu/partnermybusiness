(async function () {
  const next = new URLSearchParams(location.search).get('next') || '';
  const goTo = redirect => {
    const safe = /^(business|associate|admin)\.html(#[a-z-]+)?$/.test(next) && redirect.startsWith('/' + next.split('.')[0]);
    location.href = safe ? '/' + next : redirect;
  };

  // Already logged in? Go straight to the dashboard.
  try {
    const { user } = await api('/auth/me');
    goTo(`/${user.role}.html`);
    return;
  } catch { /* not logged in */ }

  const form = document.getElementById('signupForm');
  const roleInput = form.querySelector('input[name="role"]');
  const tabs = document.querySelectorAll('.tabs button');

  const { businessCategories, associateSkills } = await api('/auth/options').catch(() => ({
    businessCategories: ['restaurant'], associateSkills: ['chef']
  }));
  document.getElementById('category').innerHTML = businessCategories.map(c => `<option value="${c}">${pretty(c)}</option>`).join('');
  document.getElementById('skill').innerHTML = associateSkills.map(c => `<option value="${c}">${pretty(c)}</option>`).join('');

  const copy = {
    business: {
      title: 'Turn idle space into income.',
      text: 'Restaurants, hotels and salons earn from slow hours. Chefs and staff earn from their days off. Every partner gets an address on the network.',
      sample: ['restaurant', 'sadashivnagar', 'magicmasala'], catLabel: 'what you do'
    },
    associate: {
      title: 'Earn from your days off.',
      text: 'Run paid workshops in partner kitchens or pick up nearby shifts. Upload a 30-second intro and a PMB manager gets you live.',
      sample: ['chef', 'sadashivnagar', 'mahesh'], catLabel: 'your skill'
    },
    admin: {
      title: 'PMB operations team.',
      text: 'Import profiles, validate uploads and track every lead to a signed agreement.',
      sample: ['team', 'pmb', 'you'], catLabel: 'team'
    }
  };

  // Toggle fields for the chosen role; disabled inputs are left out of the submit
  function setRole(role) {
    roleInput.value = role;
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.role === role)));
    form.querySelectorAll('[data-for]').forEach(group => {
      const on = group.dataset.for === role;
      group.hidden = !on;
      group.querySelectorAll('input, select').forEach(i => (i.disabled = !on));
    });
    document.getElementById('storyTitle').textContent = copy[role].title;
    document.getElementById('storyText').textContent = copy[role].text;
    document.getElementById('segCatLabel').textContent = copy[role].catLabel;
    updateHandle();
  }

  const slug = (s, keepUnderscore) =>
    String(s || '').toLowerCase().normalize('NFKD').replace(keepUnderscore ? /[^a-z0-9_]+/g : /[^a-z0-9]+/g, '').slice(0, 40);

  function setSeg(id, value, fallback) {
    const seg = document.getElementById(id);
    seg.querySelector('b').textContent = value || fallback;
    seg.classList.toggle('filled', !!value);
    seg.classList.toggle('empty', !value);
  }

  function updateHandle() {
    const role = roleInput.value;
    const sample = copy[role].sample;
    const v = formData(form);
    if (role === 'admin') {
      setSeg('segCat', '', sample[0]); setSeg('segLoc', '', sample[1]);
      setSeg('segName', slug((v.name || '').split(' ')[0]), sample[2]);
      return;
    }
    setSeg('segCat', slug(role === 'business' ? v.category : v.skill, true), sample[0]);
    setSeg('segLoc', slug(v.location), sample[1]);
    setSeg('segName', slug(role === 'business' ? v.businessName : (v.name || '').split(' ')[0]), sample[2]);
  }

  tabs.forEach(t => t.addEventListener('click', () => setRole(t.dataset.role)));
  document.getElementById('adminToggle').addEventListener('click', () => setRole('admin'));
  form.addEventListener('input', updateHandle);
  form.addEventListener('change', updateHandle);

  document.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => {
      const login = b.dataset.go === 'login';
      document.getElementById('loginPane').hidden = !login;
      document.getElementById('signupPane').hidden = login;
      (login ? document.getElementById('loginEmail') : document.getElementById('name')).focus();
    })
  );

  onSubmit(form, async data => {
    if (!form.querySelector('[name="termsAccepted"]').checked) throw new Error('Please agree to the Terms and Conditions to create your profile');
    const { redirect } = await api('/auth/signup', { method: 'POST', body: { ...data, termsAccepted: true } });
    goTo(redirect);
  });

  onSubmit(document.getElementById('loginForm'), async data => {
    const { redirect } = await api('/auth/login', { method: 'POST', body: data });
    goTo(redirect);
  });

  const linkForm = document.getElementById('linkForm');
  document.getElementById('linkToggle').addEventListener('click', () => {
    linkForm.hidden = false;
    linkForm.email.value = document.getElementById('loginEmail').value;
    linkForm.email.focus();
  });
  onSubmit(linkForm, async data => {
    if (!/^\S+@\S+\.\S+$/.test(data.email || '')) throw new Error('Enter the email you used for your enquiry or profile');
    const r = await api('/auth/request-link', { method: 'POST', body: data });
    const msg = document.getElementById('linkMsg');
    msg.textContent = 'If that email has a dashboard, a login link is on its way. Check your inbox and spam folder.';
    if (r.devLink) msg.innerHTML += ` <br><strong>Test mode (email not set up yet):</strong> <a href="${esc(r.devLink)}">open the link</a>`;
  });

  setRole(new URLSearchParams(location.search).get('as') === 'associate' ? 'associate' : 'business');
  if (location.hash === '#login' || next) document.querySelector('[data-go="login"]').click();
})();
