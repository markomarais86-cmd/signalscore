import { useEffect, useMemo } from "react";
import { getVariantFromConfig, recordExperimentAssignment } from "@/lib/ab-testing";
import { trackABVariant } from "@/lib/analytics";

interface DescriptionVariants {
  experimentId: string;
  variants: Record<string, string>;
}

interface SEOHeadProps {
  title: string;
  description: string;
  descriptionVariants?: DescriptionVariants;
  canonicalPath?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown>;
}

/**
 * SEOHead - Dynamic meta tag management for each page
 * Updates document title and meta tags on mount
 * Supports A/B testing of meta descriptions
 */
export function SEOHead({
  title,
  description,
  descriptionVariants,
  canonicalPath = "",
  ogImage = "/og/og-default.png",
}: SEOHeadProps) {
  // Construct absolute URL for OG image (required by social platforms)
  const baseUrl = "https://launchpulse.io";
  const absoluteOgImage = ogImage.startsWith("http") 
    ? ogImage 
    : `${baseUrl}${ogImage}`;

  // Determine the final description to use
  // If variants are provided, select one deterministically
  const { finalDescription, variantKey, experimentId } = useMemo(() => {
    if (descriptionVariants && Object.keys(descriptionVariants.variants).length > 0) {
      const result = getVariantFromConfig(
        descriptionVariants.experimentId,
        descriptionVariants.variants
      );
      return {
        finalDescription: result.value,
        variantKey: result.variantKey,
        experimentId: descriptionVariants.experimentId,
      };
    }
    return {
      finalDescription: description,
      variantKey: null,
      experimentId: null,
    };
  }, [description, descriptionVariants]);

  useEffect(() => {
    // Track A/B variant if one was selected
    if (variantKey && experimentId) {
      // Record assignment for cross-session tracking
      recordExperimentAssignment(experimentId, variantKey);
      trackABVariant(experimentId, variantKey, canonicalPath);
    }
  }, [variantKey, experimentId, canonicalPath]);

  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", finalDescription);
    }

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", title);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", finalDescription);
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
      twitterDesc.setAttribute("content", finalDescription);
    }

    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg) {
      twitterImg.setAttribute("content", absoluteOgImage);
    }

    // Update canonical URL
    const fullCanonicalUrl = `${baseUrl}${canonicalPath}`;
    
    const canonicalLink = document.querySelector('link[rel="canonical"]');
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
  }, [title, finalDescription, canonicalPath, ogImage, absoluteOgImage]);

  return null;
}
