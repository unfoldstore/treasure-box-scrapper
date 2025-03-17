# Unfold Store Product Scraper

## 🚀 Project Overview

This project is designed to automate stock updates for products listed on **Treasure Box Japan** by integrating with **Unfold Store's API**. The script fetches products from the API, scrapes stock information from the **Treasure Box Japan** website, and updates the Unfold Store database accordingly.

## 🛠 How It Works

- **Authentication:** The script logs in using credentials stored in `.env` and retrieves an authentication token.
- **Product Fetching:** It requests the list of products from **Unfold Store's API** and retrieves all available items.
- **Web Scraping:** Using **Puppeteer**, it navigates to the Treasure Box product listing page and extracts product details across multiple paginated pages. After that, for each scraped product whose name matches an API product, it navigates to the product page to scrape its stock quantity.
- **Stock Updates:** After scraping, it updates the stock quantities via **PUT requests** to the API.

## 🔮 Future Enhancements

In a future iteration, the script will:

- **Filter products by `treasureBoxRefId`** before scraping, eliminating the need to process unrelated products.
- **Scrape directly from the product detail page** using the `treasureBoxRefId`, so it won't be necessary to match products by name and won't be necessary to scrape the listing page.

## 🧪 How to Run

### 1. Setup Environment Variables

Create a `.env` file with the following credentials:

```plaintext
EMAIL=recursos@unfoldstore.com.br
PASSWORD=your_password_here
```

### 2. Install Dependencies

Ensure you have Node.js installed, then run:

```sh
yarn install
```

### 3. Run the Script

```sh
node index.js
```

### 4. Staging Environment

- The script currently runs against **staging**, so test products should be created in the **[staging admin panel](https://unfold-store-admin-git-develop-unfold-stores-projects.vercel.app/products)**.

## 📌 Notes

- The **headless mode** is disabled in Puppeteer for debugging purposes but can be enabled in production.
