require("dotenv").config();
const puppeteer = require("puppeteer");
const axios = require("axios");

const API_BASE_URL = "https://staging.api.unfoldstore.com.br/v1/";
const SCRAPER_BASE_URL = "https://store.treasureboxjapan.com/details?product=";

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

// Fetch products with treasureBoxRefId
const fetchProductsWithRefId = async () => {
  console.log("📥 Fetching products from API...");
  try {
    const { data } = await apiClient.get("products");
    const filteredProducts = data.items.filter(
      (product) => product.treasureBoxRefId
    );
    console.log(
      `✅ Fetched ${filteredProducts.length} products with treasureBoxRefId.`
    );
    return new Map(
      filteredProducts.map((product) => [product.treasureBoxRefId, product])
    );
  } catch (error) {
    console.error("❌ Failed to fetch products:", error.message);
    throw error;
  }
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
  const apiProductsMap = await fetchProductsWithRefId();

  console.log("🚀 Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  for (const [refId, productData] of apiProductsMap) {
    const productUrl = `${SCRAPER_BASE_URL}${refId}`;
    console.log(`🔗 Accessing: ${productUrl}`);

    await page.goto(productUrl, { waitUntil: "networkidle2" });

    console.log(`📊 Extracting stock data for product ${refId}...`);
    const quantityStock = await extractStockQuantity(page);

    console.log(`✅ Stock for ${refId}: ${quantityStock}`);

    const updatedProduct = { ...productData, quantityStock };
    await updateProductStock(productData.id, updatedProduct);
  }

  console.log("🛑 Closing Puppeteer...");
  await browser.close();
  console.log("✅ Scraping complete.");
};

// Run main function
main().catch((error) => console.error("❌ Unexpected error:", error.message));
