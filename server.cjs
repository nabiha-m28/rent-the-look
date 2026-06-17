require('dotenv').config();
const express = require('express');
const searchHandler = require('./api/search.cjs');
const scrapeHandler = require('./api/scrape.cjs');
const app = express();

app.get('/api/search', searchHandler);
app.get('/api/scrape', scrapeHandler);

app.listen(3001, () => console.log('API running on port 3001'));
