(async function () {
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '';
  const emailParam = params.get('email') || '';
  const profileIdParam = params.get('profileId') || '';
  const switchMode = params.get('switch') === '1';
  const goTo = redirect => {
    const safe = /^(business|associate|admin|buyer)\.html(#[a-z-]+)?$/.test(next) && redirect.startsWith('/' + next.split('.')[0]);
    location.href = safe ? '/' + next : redirect;
  };

  // Keep the requested sign-in flow when an email link names a different account.
  try {
    const { user } = await api('/auth/me');
    const expectedRole = /^(business|associate|admin)\.html/.exec(next)?.[1];
    const sameRequestedProfile = user.email?.toLowerCase() === emailParam.toLowerCase()
      && (!profileIdParam || String(user._id) === profileIdParam)
      && (!expectedRole || user.role === expectedRole);
    if ((!emailParam && !switchMode) || (emailParam && sameRequestedProfile)) {
      goTo(`/${user.role}.html`);
      return;
    }
  } catch { /* not logged in */ }

  const form = document.getElementById('signupForm');
  const roleInput = form.querySelector('input[name="role"]');
  const tabs = document.querySelectorAll('.tabs button');
  const loginForm = document.getElementById('loginForm');
  const otpForm = document.getElementById('otpForm');
  const otpMessage = document.getElementById('otpMsg');

  function showOtpForm(email, devOtp, message) {
    document.getElementById('loginPane').hidden = false;
    document.getElementById('signupPane').hidden = true;
    loginForm.hidden = true;
    otpForm.hidden = false;
    otpForm.elements.email.value = email;
    document.getElementById('otpEmail').textContent = email;
    document.getElementById('otpCode').value = '';
    otpMessage.textContent = message || 'Check your inbox and spam folder. The code expires in 10 minutes.';
    if (devOtp) otpMessage.textContent += ` Local test code: ${devOtp}`;
    document.getElementById('otpCode').focus();
  }

  function resetOtpForm() {
    otpForm.hidden = true;
    loginForm.hidden = false;
    otpMessage.textContent = '';
    loginForm.elements.email.focus();
  }

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
    buyer: {
      title: 'Book spaces and professionals.',
      text: 'Find halls, kitchens, studios and skilled professionals. Our team checks every request and connects you, so your details stay private.',
      sample: ['buyer', 'bengaluru', 'you'], catLabel: 'you book'
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
    if (role === 'admin' || role === 'buyer') {
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

  onSubmit(form, async data => {
    if (!form.querySelector('[name="termsAccepted"]').checked) throw new Error('Please agree to the Terms and Conditions to create your profile');
    const result = await api('/auth/signup', { method: 'POST', body: { ...data, termsAccepted: true } });
    showOtpForm(result.email, result.devOtp, 'We sent a verification code. Check your inbox and spam folder.');
  });

  onSubmit(loginForm, async data => {
    const result = await api('/auth/request-otp', { method: 'POST', body: data });
    showOtpForm(data.email, result.devOtp, result.message || 'Check your inbox and spam folder.');
  });

  onSubmit(otpForm, async data => {
    const { redirect } = await api('/auth/verify-otp', { method: 'POST', body: data });
    goTo(redirect);
  });

  document.getElementById('resendOtp').addEventListener('click', async () => {
    otpMessage.textContent = '';
    try {
      const email = otpForm.elements.email.value;
      const result = await api('/auth/request-otp', { method: 'POST', body: { email } });
      otpMessage.textContent = result.message || 'If that email has a dashboard, a new code is on its way.';
      if (result.devOtp) otpMessage.textContent += ` Local test code: ${result.devOtp}`;
    } catch (err) {
      otpMessage.textContent = err.message;
    }
  });
  document.getElementById('changeEmail').addEventListener('click', resetOtpForm);

  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => {
    resetOtpForm();
    const login = button.dataset.go === 'login';
    document.getElementById('loginPane').hidden = !login;
    document.getElementById('signupPane').hidden = login;
    (login ? document.getElementById('loginEmail') : document.getElementById('name')).focus();
  }));

  const asRole = new URLSearchParams(location.search).get('as');
  setRole(['associate', 'buyer'].includes(asRole) ? asRole : 'business');
  const emailParam = new URLSearchParams(location.search).get('email');
  if (emailParam) document.getElementById('loginEmail').value = emailParam;
  if (location.hash === '#login' || next) {
    document.getElementById('signupPane').hidden = true;
    document.getElementById('loginPane').hidden = false;
  }
})();
