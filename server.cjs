require('dotenv').config();
const express = require('express');
const searchHandler = require('./api/search.js');
const scrapeHandler = require('./api/scrape.js');
const app = express();
const PORT = process.env.PORT || 3001;
const cors = require('cors');
app.use(cors());

app.get('/api/search', searchHandler);
app.get('/api/scrape', scrapeHandler);

app.listen(PORT, () => console.log(`API running on port ${PORT}`));

