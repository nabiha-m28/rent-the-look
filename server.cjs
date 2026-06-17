require('dotenv').config();
const express = require('express');
const searchHandler = require('./api/search.cjs');
const scrapeHandler = require('./api/scrape.cjs');
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/api/search', searchHandler);
app.get('/api/scrape', scrapeHandler);

app.listen(PORT, () => console.log(`API running on port ${PORT}`));

