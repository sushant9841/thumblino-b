const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const app = express();
const port = process.env.PORT || 5000;
const cacheDirectory = path.join(__dirname, "cached_images");

app.use(cors());
app.use(bodyParser.json());

if (!fs.existsSync(cacheDirectory)) {
  fs.mkdirSync(cacheDirectory);
}

// Endpoint to capture screenshots
app.get(
  "/get/width/:width/height/:height/quality/:quality/scale/:scale/page/:pageType/url/:url",
  async (req, res) => {
    const { width, height, quality, scale, pageType, url } = req.params;

    try {
      const cacheKey = `${width}*${height}_${quality}_${scale}_${pageType}_${encodeURIComponent(
        url
      )}`;
      const cachedImagePath = path.join(cacheDirectory, `${cacheKey}.jpg`);

      // Check if screenshot is already cached
      if (fs.existsSync(cachedImagePath)) {
        console.log(`Returning cached image for ${url}`);
        const cachedImage = fs.readFileSync(cachedImagePath);
        res.setHeader("Content-Type", "image/jpeg");
        return res.send(cachedImage);
      }

      // If not cached, capture screenshot
      const screenshot = await takeScreenshot(url, {
        width: parseInt(width),
        height: parseInt(height),
        quality: parseInt(quality),
        scale: parseFloat(scale),
        pageType: pageType.toLowerCase(),
      });

      // Save screenshot to cache directory
      fs.writeFileSync(cachedImagePath, screenshot);

      // Send the screenshot as response
      res.setHeader("Content-Type", "image/jpeg");
      res.send(screenshot);
    } catch (error) {
      console.error("Error capturing or caching screenshot:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Function to capture screenshot using Puppeteer and scale it using Sharp
async function takeScreenshot(url, options) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // Adjust as needed for your environment
  });
  const page = await browser.newPage();

  try {
    const viewport = {
      width: options.width,
      height: options.height === 0 ? 1080 : options.height, // Use 1080 as a default height for full-page screenshots
    };
    await page.setViewport(viewport);

    // Navigate to the URL and capture screenshot
    await page.goto(`http://${url}`, { waitUntil: "networkidle2" }); // Adjust as necessary
    const screenshotBuffer = await page.screenshot({
      type: "jpeg",
      quality: options.quality,
      fullPage: options.height === 0, // Capture full page if height is 0
    });

    await browser.close();

    // Scale the image using Sharp
    const scaledImageBuffer = await sharp(screenshotBuffer)
      .resize({
        width: Math.round(viewport.width * options.scale),
        height:
          options.height === 0
            ? null
            : Math.round(viewport.height * options.scale), // Preserve aspect ratio for full-page
      })
      .toBuffer();

    return scaledImageBuffer;
  } catch (error) {
    console.error("Error navigating or capturing screenshot:", error);
    await browser.close();
    throw error; // Propagate the error back to the calling function
  }
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
