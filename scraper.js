const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jsonfile = require('jsonfile');
const NodeCache = require('node-cache');

// Configuration
const cache = new NodeCache({ stdTTL: 3600 });
const baseURL = 'https://dentalstall.com/shop/page/';
const outputPath = path.join(__dirname, 'products.json');
const imageOutputDir = path.join(__dirname, 'images');

// Create images directory if it doesn't exist
if (!fs.existsSync(imageOutputDir)) {
  fs.mkdirSync(imageOutputDir);
}

async function fetchHTML(url) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const content = await page.content();
    await browser.close();
    return cheerio.load(content); // Return cheerio instance
  } catch (error) {
    console.error(`Error fetching URL: ${url}`, error);
    return null;
  }
}

async function scrapeProductData(pageNum) {
  const url = `${baseURL}${pageNum}/`;
  const $ = await fetchHTML(url);
  if (!$) return [];

  console.log(`Scraping page: ${url}`);

  const products = [];
  $('.product').each((_, element) => {
    const product = {};
    product.title = $(element).find('.woocommerce-loop-product__title').text().trim();
    product.price = parseFloat($(element).find('.price').text().replace(/[^\d.-]/g, ''));
    const imageUrl = $(element).find('.attachment-woocommerce_thumbnail').attr('src');

    if (imageUrl) {
      const imagePath = path.join(imageOutputDir, path.basename(imageUrl));
      axios({
        url: imageUrl,
        responseType: 'stream',
      }).then(response => {
        response.data.pipe(fs.createWriteStream(imagePath));
      }).catch(err => {
        console.error(`Error downloading image: ${imageUrl}`, err);
      });
      product.imagePath = imagePath;
    } else {
      product.imagePath = ''; // Handle cases with no image
    }

    products.push(product);
  });

  console.log(`Found ${products.length} products on page ${pageNum}`);
  return products;
}

async function scrapeData(maxPages, proxy = null) {
  let allProducts = [];
  for (let i = 1; i <= maxPages; i++) {
    const products = await scrapeProductData(i);
    allProducts = allProducts.concat(products);
  }

  return allProducts;
}

function saveData(products) {
  jsonfile.writeFile(outputPath, products, { spaces: 2 }, err => {
    if (err) console.error('Error writing to file', err);
    else console.log(`Saved ${products.length} products to ${outputPath}`);
  });
}

module.exports = { scrapeData, saveData, cache };
