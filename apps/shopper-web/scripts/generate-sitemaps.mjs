import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE_URL = "https://www.unitedpharmacy.net";
const DEFAULT_SUPABASE_URL = "https://envoy-production-1cbe.up.railway.app";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI";
const PAGE_SIZE = 1000;
const FETCH_CONCURRENCY = 6;
const URLS_PER_SITEMAP = 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const defaultOutputDir = path.resolve(appRoot, "dist");
const buildTimestamp = new Date().toISOString();

const siteUrl = stripTrailingSlash(
  process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);
const supabaseUrl = stripTrailingSlash(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
);
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const categoryRules = [
  {
    id: "medications",
    aliases: [
      "medications",
      "medication",
      "medicine",
      "medicines",
      "pharmaceuticals",
      "prescription",
      "otc",
      "drugs",
      "الأدوية",
      "ادوية",
      "الأدوية والعلاجات",
      "علاجات",
    ],
  },
  {
    id: "vitamins-supplements",
    aliases: [
      "vitamins",
      "supplements",
      "vitamins supplements",
      "vitamin supplements",
      "nutrition",
      "wellness",
      "dietary supplements",
      "الفيتامينات",
      "المكملات",
      "الفيتامينات والمكملات",
    ],
  },
  {
    id: "skin-care",
    aliases: [
      "skin care",
      "skincare",
      "face care",
      "dermocosmetics",
      "العناية بالبشرة",
      "بشرة",
      "منتجات البشرة",
    ],
  },
  {
    id: "personal-care",
    aliases: [
      "personal care",
      "body care",
      "hair care",
      "hygiene",
      "العناية الشخصية",
      "العناية بالجسم",
      "العناية بالشعر",
    ],
  },
  {
    id: "baby-mother-care",
    aliases: [
      "baby mother care",
      "baby care",
      "mother care",
      "kids care",
      "الأم والطفل",
      "الام والطفل",
      "الأطفال",
    ],
  },
  {
    id: "oral-care",
    aliases: [
      "oral care",
      "dental care",
      "teeth care",
      "العناية بالفم",
      "العناية بالاسنان",
      "العناية بالفم والأسنان",
    ],
  },
  {
    id: "first-aid-supplies",
    aliases: [
      "first aid",
      "first aid supplies",
      "medical supplies",
      "consumables",
      "الإسعافات",
      "المستلزمات",
      "مستلزمات طبية",
    ],
  },
  {
    id: "medical-devices",
    aliases: [
      "medical devices",
      "medical device",
      "devices",
      "equipment",
      "الأجهزة الطبية",
      "اجهزة طبية",
      "الأجهزة",
    ],
  },
  {
    id: "general-healthcare",
    aliases: [
      "general healthcare",
      "general",
      "misc",
      "household",
      "الصحة العامة",
      "عام",
      "عناية عامة",
    ],
  },
];

const staticRoutes = [
  {
    path: "/",
    changefreq: "daily",
    priority: "1.0",
    sourceFiles: ["src/app/pages/Home.tsx", "src/app/pages/HomeMobile.tsx"],
  },
  {
    path: "/products",
    changefreq: "daily",
    priority: "0.9",
    sourceFiles: ["src/app/pages/Products.tsx", "src/app/pages/ProductDetails.tsx"],
  },
  {
    path: "/categories",
    changefreq: "daily",
    priority: "0.8",
    sourceFiles: ["src/app/pages/Categories.tsx", "src/app/pages/CategoryDetails.tsx"],
  },
  {
    path: "/offers",
    changefreq: "daily",
    priority: "0.8",
    sourceFiles: ["src/app/pages/Offers.tsx"],
  },
  {
    path: "/about",
    changefreq: "monthly",
    priority: "0.7",
    sourceFiles: ["src/app/pages/About.tsx", "src/app/pages/AboutMobile.tsx"],
  },
  {
    path: "/contact",
    changefreq: "monthly",
    priority: "0.7",
    sourceFiles: ["src/app/pages/Contact.tsx"],
  },
  {
    path: "/special-orders",
    changefreq: "weekly",
    priority: "0.7",
    sourceFiles: ["src/app/pages/SpecialOrders.tsx"],
  },
  {
    path: "/shipping",
    changefreq: "monthly",
    priority: "0.4",
    sourceFiles: ["src/app/pages/SupportPage.tsx", "src/data/policyData.ts"],
  },
  {
    path: "/returns",
    changefreq: "monthly",
    priority: "0.4",
    sourceFiles: ["src/app/pages/Returns.tsx", "src/data/policyData.ts"],
  },
  {
    path: "/faq",
    changefreq: "monthly",
    priority: "0.4",
    sourceFiles: ["src/app/pages/SupportPage.tsx", "src/data/policyData.ts"],
  },
  {
    path: "/terms",
    changefreq: "monthly",
    priority: "0.3",
    sourceFiles: ["src/app/pages/SupportPage.tsx", "src/data/policyData.ts"],
  },
  {
    path: "/privacy",
    changefreq: "monthly",
    priority: "0.3",
    sourceFiles: ["src/app/pages/SupportPage.tsx", "src/data/policyData.ts"],
  },
];

function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeForMatch(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function chunk(array, size) {
  const parts = [];
  for (let index = 0; index < array.length; index += size) {
    parts.push(array.slice(index, index + size));
  }
  return parts;
}

function asIsoDate(value) {
  const date = value ? new Date(value) : new Date(buildTimestamp);
  return Number.isNaN(date.getTime()) ? buildTimestamp : date.toISOString();
}

function resolveCanonicalCategoryId(...candidates) {
  const normalizedCandidates = candidates
    .map((candidate) => normalizeForMatch(candidate))
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    for (const rule of categoryRules) {
      if (
        candidate === rule.id ||
        rule.aliases.some((alias) => normalizeForMatch(alias) === candidate)
      ) {
        return rule.id;
      }
    }
  }

  return "general-healthcare";
}

function buildAbsoluteUrl(pathname) {
  return `${siteUrl}${pathname}`;
}

function selectProductName(row) {
  return row.Name_En || row.Name || row.Name_Ar || row.Code || row.id || "Product";
}

function isHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function getLatestFileTimestamp(relativePaths) {
  const timestamps = await Promise.all(
    relativePaths.map(async (relativePath) => {
      try {
        const fileStats = await stat(path.resolve(appRoot, relativePath));
        return fileStats.mtime.toISOString();
      } catch {
        return buildTimestamp;
      }
    }),
  );

  return timestamps.sort().at(-1) || buildTimestamp;
}

const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

async function requestSupabase(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Supabase request timed out after ${SUPABASE_REQUEST_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${body}`);
  }

  return response;
}

async function fetchProductCount() {
  const countUrl = new URL("/rest/v1/products", supabaseUrl);
  countUrl.searchParams.set("select", "id");
  countUrl.searchParams.set("limit", "1");

  const response = await requestSupabase(countUrl, {
    headers: { Prefer: "count=exact" },
  });
  const contentRange = response.headers.get("content-range") || "";
  const total = Number(contentRange.split("/").at(-1));

  if (!Number.isFinite(total)) {
    throw new Error("Failed to read the total product count from Supabase.");
  }

  return total;
}

async function fetchProductPage(offset) {
  const url = new URL("/rest/v1/products", supabaseUrl);
  url.searchParams.set(
    "select",
    "id,Code,Name,Name_Ar,Name_En,Category_Name,Category_Name_En,image_url,is_active,created_at,updated_at",
  );
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  const response = await requestSupabase(url);
  return response.json();
}

async function fetchAllProducts() {
  const totalCount = await fetchProductCount();
  if (totalCount === 0) {
    return [];
  }

  const offsets = [];
  for (let offset = 0; offset < totalCount; offset += PAGE_SIZE) {
    offsets.push(offset);
  }

  const rows = [];
  for (let index = 0; index < offsets.length; index += FETCH_CONCURRENCY) {
    const wave = offsets.slice(index, index + FETCH_CONCURRENCY);
    const pages = await Promise.all(wave.map((offset) => fetchProductPage(offset)));
    for (const pageRows of pages) {
      rows.push(...pageRows);
    }
  }

  return rows;
}

function renderUrlSet(entries, namespaces = "") {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${namespaces}>`,
    ...entries.map((entry) => entry.trim()),
    "</urlset>",
    "",
  ].join("\n");
}

function renderSitemapIndex(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (entry) =>
        [
          "  <sitemap>",
          `    <loc>${escapeXml(entry.loc)}</loc>`,
          `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`,
          "  </sitemap>",
        ].join("\n"),
    ),
    "</sitemapindex>",
    "",
  ].join("\n");
}

function buildUrlEntry({ loc, lastmod, changefreq, priority }) {
  const lines = ["  <url>", `    <loc>${escapeXml(loc)}</loc>`, `    <lastmod>${escapeXml(lastmod)}</lastmod>`];

  if (changefreq) {
    lines.push(`    <changefreq>${changefreq}</changefreq>`);
  }

  if (priority) {
    lines.push(`    <priority>${priority}</priority>`);
  }

  lines.push("  </url>");
  return lines.join("\n");
}

function buildImageEntry({ loc, lastmod, imageLoc, imageTitle }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    "    <image:image>",
    `      <image:loc>${escapeXml(imageLoc)}</image:loc>`,
    `      <image:title>${escapeXml(imageTitle)}</image:title>`,
    "    </image:image>",
    "  </url>",
  ].join("\n");
}

async function clearExistingSitemaps(outputDir) {
  await mkdir(outputDir, { recursive: true });
  const files = await readdir(outputDir);
  const sitemapFiles = files.filter((fileName) => /^sitemap(?:-.+)?\.xml$/i.test(fileName));
  await Promise.all(sitemapFiles.map((fileName) => unlink(path.join(outputDir, fileName))));
}

async function writeXmlFile(outputDir, fileName, xml) {
  await writeFile(path.join(outputDir, fileName), xml, "utf8");
}

async function writeRobotsTxt(outputDir) {
  const robotsLines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /ops",
    "Disallow: /driver",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /profile",
    "Disallow: /orders",
    "Disallow: /wishlist",
    "Disallow: /favorites",
    "Disallow: /track",
    "Disallow: /suspended",
    "Disallow: /suspension-info",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ];

  await writeFile(path.join(outputDir, "robots.txt"), robotsLines.join("\n"), "utf8");
}

export async function generateSitemapFiles(outputDir = defaultOutputDir) {
  await clearExistingSitemaps(outputDir);

  const [productRows, staticPageEntries] = await Promise.all([
    fetchAllProducts(),
    Promise.all(
      staticRoutes.map(async (route) => ({
        loc: buildAbsoluteUrl(route.path),
        lastmod: await getLatestFileTimestamp(route.sourceFiles),
        changefreq: route.changefreq,
        priority: route.priority,
      })),
    ),
  ]);

  const activeProducts = productRows.filter((row) => row.is_active !== false && row.id);
  const productEntries = activeProducts.map((row) => ({
    loc: buildAbsoluteUrl(`/products/${encodeURIComponent(String(row.id))}`),
    lastmod: asIsoDate(row.updated_at || row.created_at),
    changefreq: "weekly",
    priority: "0.7",
  }));

  const categoryMap = new Map();
  const imageEntries = [];

  for (const row of activeProducts) {
    const categoryId = resolveCanonicalCategoryId(
      row.Category_Name_En,
      row.Category_Name,
      row.Name_En,
      row.Name_Ar,
    );
    const lastmod = asIsoDate(row.updated_at || row.created_at);
    const existingCategory = categoryMap.get(categoryId);

    if (!existingCategory || existingCategory.lastmod < lastmod) {
      categoryMap.set(categoryId, {
        loc: buildAbsoluteUrl(`/categories/${encodeURIComponent(categoryId)}`),
        lastmod,
        changefreq: "weekly",
        priority: "0.6",
      });
    }

    if (isHttpUrl(row.image_url)) {
      imageEntries.push({
        loc: buildAbsoluteUrl(`/products/${encodeURIComponent(String(row.id))}`),
        lastmod,
        imageLoc: row.image_url,
        imageTitle: selectProductName(row),
      });
    }
  }

  const categoryEntries = Array.from(categoryMap.values()).sort((left, right) =>
    left.loc.localeCompare(right.loc),
  );

  const sitemapIndexEntries = [];

  await writeXmlFile(
    outputDir,
    "sitemap-pages.xml",
    renderUrlSet(staticPageEntries.map((entry) => buildUrlEntry(entry))),
  );
  sitemapIndexEntries.push({
    loc: `${siteUrl}/sitemap-pages.xml`,
    lastmod: staticPageEntries.map((entry) => entry.lastmod).sort().at(-1) || buildTimestamp,
  });

  await writeXmlFile(
    outputDir,
    "sitemap-categories.xml",
    renderUrlSet(categoryEntries.map((entry) => buildUrlEntry(entry))),
  );
  sitemapIndexEntries.push({
    loc: `${siteUrl}/sitemap-categories.xml`,
    lastmod: categoryEntries.map((entry) => entry.lastmod).sort().at(-1) || buildTimestamp,
  });

  const productChunks = chunk(productEntries, URLS_PER_SITEMAP);
  for (const [index, entries] of productChunks.entries()) {
    const fileName = `sitemap-products-${index + 1}.xml`;
    await writeXmlFile(outputDir, fileName, renderUrlSet(entries.map((entry) => buildUrlEntry(entry))));
    sitemapIndexEntries.push({
      loc: `${siteUrl}/${fileName}`,
      lastmod: entries.map((entry) => entry.lastmod).sort().at(-1) || buildTimestamp,
    });
  }

  const imageChunks = chunk(imageEntries, URLS_PER_SITEMAP);
  for (const [index, entries] of imageChunks.entries()) {
    const fileName = `sitemap-images-${index + 1}.xml`;
    await writeXmlFile(
      outputDir,
      fileName,
      renderUrlSet(
        entries.map((entry) => buildImageEntry(entry)),
        ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
      ),
    );
    sitemapIndexEntries.push({
      loc: `${siteUrl}/${fileName}`,
      lastmod: entries.map((entry) => entry.lastmod).sort().at(-1) || buildTimestamp,
    });
  }

  await writeXmlFile(outputDir, "sitemap.xml", renderSitemapIndex(sitemapIndexEntries));
  await writeRobotsTxt(outputDir);

  return {
    outputDir,
    siteUrl,
    staticPages: staticPageEntries.length,
    categoryPages: categoryEntries.length,
    productPages: productEntries.length,
    imageEntries: imageEntries.length,
    productSitemaps: productChunks.length,
    imageSitemaps: imageChunks.length,
  };
}

const executedDirectly = process.argv[1] === __filename;

if (executedDirectly) {
  generateSitemapFiles().then(
    (summary) => {
      console.log(JSON.stringify(summary, null, 2));
    },
    (error) => {
      console.error("[generate-sitemaps]", error);
      process.exitCode = 1;
    },
  );
}
