export function generateSitemapFiles(outputDir?: string): Promise<{
  outputDir: string;
  siteUrl: string;
  staticPages: number;
  categoryPages: number;
  productPages: number;
  imageEntries: number;
  productSitemaps: number;
  imageSitemaps: number;
}>;
