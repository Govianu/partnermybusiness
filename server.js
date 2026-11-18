require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { initialize } = require('./utils/jsonModel');
const { verifyMail } = require('./utils/mailer');

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in .env (see .env.example)');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx (used for rate limits and the terms record)
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/business', require('./routes/business'));
app.use('/api/associate', require('./routes/associate'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/public', require('./routes/public'));
app.use('/api/enquiry', require('./routes/enquiry'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, 'public')));

// Express 5 forwards rejected promises from async handlers here
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'That record already exists' });
  }
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 3000;
initialize();
verifyMail();
app.listen(PORT, () => console.log(`partnermybusiness running on http://localhost:${PORT}`));
