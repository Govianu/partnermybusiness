// Generates "ways to earn more" pitch cards for a business.
// Uses the Anthropic API when ANTHROPIC_API_KEY is set; otherwise falls back to templates.

const TEMPLATES = {
  restaurant: [
    { title: 'Rent your idle kitchen as a cloud kitchen', idleAsset: 'Kitchen, 3pm–6pm and after 11pm', estMonthly: 45000,
      pitch: 'Delivery brands need a licensed kitchen for a few hours a day. Your kitchen already has the equipment and FSSAI licence — earn rent without changing your menu.' },
    { title: 'Host kids’ birthday parties on slow mornings', idleAsset: 'Dining hall, Mon–Thu 10am–1pm', estMonthly: 60000,
      pitch: '15-kid birthday packages with a fixed menu fill your quietest hours. Event managers bring the guests; you provide the space and food.' },
    { title: 'Let a chef run a paid cooking workshop', idleAsset: 'Kitchen, one weekend morning a month', estMonthly: 50000,
      pitch: 'A partner chef teaches a signature recipe to paying students in your kitchen. You earn a venue share and new regulars.' }
  ],
  hotel: [
    { title: 'Day-use rooms for business travellers', idleAsset: 'Unsold rooms, 10am–5pm', estMonthly: 80000,
      pitch: 'Rooms that sit empty between checkout and check-in can be sold by the hour to travellers and freelancers.' },
    { title: 'Small corporate offsites in your banquet hall', idleAsset: 'Banquet hall, weekdays', estMonthly: 120000,
      pitch: 'Startups need 20–40 person spaces for a day. Bundle the hall, Wi-Fi and lunch into one price.' },
    { title: 'Weekend workshops and classes', idleAsset: 'Conference room, weekends', estMonthly: 40000,
      pitch: 'Yoga, art and cooking instructors pay for a clean, central room. You earn without adding staff.' }
  ],
  salon: [
    { title: 'Bridal and event packages with partner artists', idleAsset: 'Chairs, weekday mornings', estMonthly: 35000,
      pitch: 'Freelance makeup artists use your chairs for bridal trials and pay per slot.' },
    { title: 'Grooming workshops for beginners', idleAsset: 'Salon floor, Sunday afternoons', estMonthly: 25000,
      pitch: 'Host paid beginner classes taught by your senior stylists on your slowest day.' },
    { title: 'Corporate wellness days', idleAsset: 'Staff time, weekdays', estMonthly: 40000,
      pitch: 'Send stylists to nearby offices for on-site grooming days booked through PMB.' }
  ],
  default: [
    { title: 'Rent out idle space by the hour', idleAsset: 'Unused space during slow hours', estMonthly: 30000,
      pitch: 'Event managers and instructors are looking for small, central spaces. List your slow hours and accept bookings with one tap.' },
    { title: 'Host community workshops', idleAsset: 'Space, weekends', estMonthly: 25000,
      pitch: 'Partner associates run paid workshops at your venue; you earn a share of every seat sold.' },
    { title: 'Cut supply costs by buying direct', idleAsset: 'Monthly purchasing', estMonthly: 20000,
      pitch: 'Group purchasing with nearby businesses lets you buy directly from producers and skip distributor margins.' }
  ]
};

function scriptFor(name, o) {
  return `[0–5s] ${name}, your ${o.idleAsset.split(',')[0].toLowerCase()} sits idle more than you think.\n` +
    `[5–20s] ${o.pitch}\n` +
    `[20–30s] That’s up to ₹${o.estMonthly.toLocaleString('en-IN')} extra a month. Tap Accept on partnermybusiness.ai to start.`;
}

function fromTemplates({ name, category }) {
  const list = TEMPLATES[category] || TEMPLATES.default;
  return list.map(o => ({ ...o, videoScript: scriptFor(name, o), source: 'template' }));
}

async function generateOpportunities({ name, category, location }) {
  if (!process.env.ANTHROPIC_API_KEY) return fromTemplates({ name, category });

  const prompt = `You write opportunity pitch cards for partnermybusiness.ai, a Bengaluru platform that helps local businesses earn from idle space and time.
Business: "${name}", category: ${category}, area: ${location}, Bengaluru.
Return ONLY a JSON array of 3 objects, no markdown, each with:
"title" (max 60 chars), "idleAsset" (what is idle and when), "pitch" (2 sentences, plain language),
"estMonthly" (realistic extra INR per month as an integer), "videoScript" (a 30-second voiceover script with [0–5s] style timestamps).`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = await res.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty AI response');
    return parsed.slice(0, 5).map(o => ({
      title: String(o.title || 'New opportunity'),
      idleAsset: String(o.idleAsset || ''),
      pitch: String(o.pitch || ''),
      estMonthly: Number(o.estMonthly) || 0,
      videoScript: String(o.videoScript || ''),
      source: 'ai'
    }));
  } catch (err) {
    console.warn('AI generation failed, using templates:', err.message);
    return fromTemplates({ name, category });
  }
}

const SOPS = {
  restaurant: ['Kitchen hand-over checklist', 'Hygiene & FSSAI compliance for guest chefs', 'Birthday party run sheet (15 kids)', 'Damage & deposit policy'],
  hotel: ['Day-use room turnover SOP', 'Banquet booking checklist', 'Guest ID & safety policy'],
  salon: ['Chair rental agreement', 'Hygiene SOP for visiting artists', 'Workshop run sheet'],
  default: ['Venue hand-over checklist', 'Booking & cancellation policy', 'Safety & insurance checklist']
};
const sopsFor = category => SOPS[category] || SOPS.default;

module.exports = { generateOpportunities, sopsFor };
