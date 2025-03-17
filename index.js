require("dotenv").config();
const puppeteer = require("puppeteer");
const axios = require("axios");

const API_BASE_URL = "https://staging.api.unfoldstore.com.br/v1/";
const SCRAPER_BASE_URL =
  "https://store.treasureboxjapan.com/products?preOrder=true&inStock=undefined&outOfStock=undefined&preOwned=undefined&tab=1";

// Delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Authenticate and get user token
const authenticate = async () => {
  console.log("🔐 Authenticating...");
  try {
    const response = await apiClient.post("auth/sign-in", {
      email: process.env.EMAIL,
      password: process.env.PASSWORD,
    });

    const token = response.data.userToken.token;
    if (!token) throw new Error("Authentication failed. No token received.");

    apiClient.defaults.headers["Authorization"] = `Bearer ${token}`;
    console.log("✅ Authentication successful.");
    return token;
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    throw error;
  }
};

// Fetch products from API
const fetchProducts = async () => {
  console.log("📥 Fetching products from API...");
  try {
    const { data } = await apiClient.get("products");
    console.log(`✅ Fetched ${data.items.length} products.`);
    return new Map(data.items.map((product) => [product.character, product]));
  } catch (error) {
    console.error("❌ Failed to fetch products:", error.message);
    throw error;
  }
};

// Scrape products from the website
const scrapeProducts = async (page) => {
  console.log("🔍 Scraping products...");
  let allScrapedProducts = [];

  while (true) {
    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("div.css-5w95k > div.css-0"))
        .map((product) => {
          const linkElement = product.querySelector("a");
          const characterElement = product.querySelector(
            "div.css-182w6d6 > p:first-child"
          );

          return {
            link: linkElement ? linkElement.href : null,
            character: characterElement
              ? characterElement.innerText.trim()
              : null,
          };
        })
        .filter((product) => product.link && product.character);
    });

    console.log(`✅ Found ${products.length} products on this page.`);
    allScrapedProducts.push(...products);

    // Check for next page
    const isNextDisabled = await page.evaluate(() => {
      const nextButton = document.querySelector(
        '[aria-label="Go to next page"]'
      );
      return nextButton ? nextButton.disabled : true;
    });

    if (isNextDisabled) {
      console.log("⏹ No more pages to scrape.");
      break;
    }

    console.log("➡ Clicking next page...");
    await page.click('[aria-label="Go to next page"]');
    await delay(2000);
  }

  return allScrapedProducts;
};

// Extract stock quantity from product page
const extractStockQuantity = async (page) => {
  return await page.evaluate(() => {
    const stockElement = Array.from(document.querySelectorAll("p")).find((p) =>
      p.innerText.includes("Stock:")
    );

    return stockElement
      ? parseInt(stockElement.innerText.replace(/\D/g, ""), 10) || 0
      : 0;
  });
};

// Update product stock in API
const updateProductStock = async (productId, updatedProduct) => {
  console.log(
    `📤 Updating product ${productId} with stock ${updatedProduct.quantityStock}...`
  );
  try {
    await apiClient.put(`products/${productId}`, updatedProduct);
    console.log(`✅ Successfully updated product ${productId}.`);
  } catch (error) {
    console.error(`❌ Failed to update product ${productId}:`, error.message);
  }
};

// Main function
const main = async () => {
  await authenticate();
  const apiProductsMap = await fetchProducts();

  console.log("🚀 Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log(`🌍 Navigating to ${SCRAPER_BASE_URL}...`);
  await page.goto(SCRAPER_BASE_URL, { waitUntil: "networkidle2" });

  const allScrapedProducts = await scrapeProducts(page);

  console.log(`🔎 Processing ${allScrapedProducts.length} scraped products...`);

  for (const scrapedProduct of allScrapedProducts) {
    if (apiProductsMap.has(scrapedProduct.character)) {
      const productData = apiProductsMap.get(scrapedProduct.character);
      console.log(`🔗 Accessing: ${scrapedProduct.link}`);

      await page.goto(scrapedProduct.link, { waitUntil: "networkidle2" });

      console.log(
        `📊 Extracting stock data for ${scrapedProduct.character}...`
      );
      const quantityStock = await extractStockQuantity(page);

      console.log(`✅ Stock for ${scrapedProduct.character}: ${quantityStock}`);

      const updatedProduct = { ...productData, quantityStock };
      await updateProductStock(productData.id, updatedProduct);
    }
  }

  console.log("🛑 Closing Puppeteer...");
  await browser.close();
  console.log("✅ Scraping complete.");
};

// Run main function
main().catch((error) => console.error("❌ Unexpected error:", error.message));
