import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
}

/**
 * SEOHead - Dynamic meta tag management for each page
 * Updates document title and meta tags on mount
 */
export function SEOHead({
  title,
  description,
  canonicalPath = "",
  ogImage = "/og/og-default.png",
}: SEOHeadProps) {
  // Construct absolute URL for OG image (required by social platforms)
  const baseUrl = "https://launchpulse.io";
  const absoluteOgImage = ogImage.startsWith("http") 
    ? ogImage 
    : `${baseUrl}${ogImage}`;
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", description);
    }

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", title);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", description);
    }

    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) {
      ogImg.setAttribute("content", absoluteOgImage);
    }

    // Update Twitter tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute("content", title);
    }

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.setAttribute("content", description);
    }

    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg) {
      twitterImg.setAttribute("content", absoluteOgImage);
    }

    // Update canonical URL
    const baseUrl = "https://launchpulse.io";
    const fullCanonicalUrl = `${baseUrl}${canonicalPath}`;
    
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute("href", fullCanonicalUrl);
    }

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute("content", fullCanonicalUrl);
    }

    const twitterUrl = document.querySelector('meta[name="twitter:url"]');
    if (twitterUrl) {
      twitterUrl.setAttribute("content", fullCanonicalUrl);
    }
  }, [title, description, canonicalPath, ogImage]);

  return null;
}
