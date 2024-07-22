const express = require('express');
const { scrapeData, saveData, cache } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_TOKEN = 'my-static-token';

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Authentication Middleware
function authenticate(req, res, next) {
  const token = req.headers['authorization'];
  if (token === `Bearer ${STATIC_TOKEN}`) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
}

// Scrape Endpoint
app.post('/scrape', authenticate, async (req, res) => {
  const { pages, proxy } = req.body;

  const cachedData = cache.get('products');
  if (cachedData) {
    return res.json(cachedData);
  }
  console.log("pages", pages);
  console.log("proxy", proxy);

  const products = await scrapeData(pages, proxy);
  saveData(products);
  cache.set('products', products);

  res.json(products);
});

// Notification Endpoint (for simplicity, we log to the console)
app.post('/notify', authenticate, (req, res) => {
  const message = `Scraped and updated ${req.body.count} products in the database.`;
  console.log(message);
  res.send(message);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
