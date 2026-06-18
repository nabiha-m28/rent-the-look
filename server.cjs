require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.get('/api/search', async (req, res) => {
  const { default: handler } = await import('./api/search.js');
  return handler(req, res);
});

app.get('/api/scrape', async (req, res) => {
  const { default: handler } = await import('./api/scrape.js');
  return handler(req, res);
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));