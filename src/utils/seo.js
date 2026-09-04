// Situs default (dipakai sebagai fallback saat parameter tidak diisi)
export const SITE_NAME = 'Ndichan';
export const SITE_URL = 'https://ndichan.xyz';
export const DEFAULT_OG_IMAGE = 'https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/Proyek%20Baru%2052%20%5BB51360C%5D.png';

/**
 * SEO Utility untuk mengatur meta tags dan structured data secara dinamis pada Single Page Application (SPA).
 * @param {string} title - Judul halaman
 * @param {string} description - Meta description
 * @param {string|null} image - URL gambar OG / Twitter
 * @param {string|null} url - Canonical URL
 * @param {object} options - Opsi tambahan { keywords, noIndex, type, schema, locale }
 */
export const setSeoMeta = (title, description, image, url, options = {}) => {
  const { keywords, noIndex = false, type = 'website', schema = null, locale = 'id_ID' } = options;
  const finalImage = image || DEFAULT_OG_IMAGE;
  const finalUrl = url || (typeof window !== 'undefined' ? window.location.href : SITE_URL);

  // Update document title
  document.title = title;

  // Update atau buat meta description
  let metaDescription = document.querySelector('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    document.head.appendChild(metaDescription);
  }
  metaDescription.content = description || '';

  // Update meta keywords (opsional)
  if (keywords) {
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = keywords;
  }

  // Update robots (index/follow vs noindex untuk halaman privat seperti admin/profile)
  setRobotsMeta(noIndex);

  // Update Open Graph tags
  updateMetaTag('og:title', title);
  updateMetaTag('og:description', description || '');
  updateMetaTag('og:image', finalImage);
  updateMetaTag('og:image:secure_url', finalImage);
  updateMetaTag('og:image:alt', title);
  updateMetaTag('og:url', finalUrl);
  updateMetaTag('og:type', type);
  updateMetaTag('og:site_name', SITE_NAME);
  updateMetaTag('og:locale', locale);

  // Update Twitter tags
  updateMetaTag('twitter:card', 'summary_large_image', 'name');
  updateMetaTag('twitter:title', title, 'name');
  updateMetaTag('twitter:description', description || '', 'name');
  updateMetaTag('twitter:image', finalImage, 'name');
  updateMetaTag('twitter:image:alt', title, 'name');

  // Update canonical
  updateCanonical(finalUrl);

  // Update Schema Markup (JSON-LD)
  if (schema) {
    addSchemaMarkup(schema);
  }
};

const setRobotsMeta = (noIndex) => {
  let tag = document.querySelector('meta[name="robots"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'robots';
    document.head.appendChild(tag);
  }
  tag.content = noIndex
    ? 'noindex, nofollow'
    : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
};

const updateMetaTag = (key, content, keyAttr = 'property') => {
  let tag = document.querySelector(`meta[${keyAttr}="${key}"], meta[name="${key}"], meta[property="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(keyAttr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
};

const updateCanonical = (url) => {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
};

// Add or update Schema Markup in head
export const addSchemaMarkup = (schema) => {
  let script = document.getElementById('ndichan-seo-schema');
  if (!script) {
    script = document.createElement('script');
    script.id = 'ndichan-seo-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
};

// Breadcrumb Schema Helper
export const getBreadcrumbSchema = (items = []) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`
    }))
  };
};

// Schema Markup untuk Anime Episode / Streaming
export const getAnimeSchema = (animeData = {}) => {
  const isEpisode = !!animeData.episodeNumber;
  const canonicalUrl = animeData.url || SITE_URL;
  const poster = animeData.image || DEFAULT_OG_IMAGE;

  if (isEpisode) {
    return {
      '@context': 'https://schema.org',
      '@type': 'TVEpisode',
      name: `${animeData.title} Episode ${animeData.episodeNumber}`,
      description: animeData.description || `Nonton anime ${animeData.title} Episode ${animeData.episodeNumber} subtitle Indonesia di Ndichan.`,
      image: poster,
      url: canonicalUrl,
      episodeNumber: animeData.episodeNumber,
      partOfSeries: {
        '@type': 'TVSeries',
        name: animeData.title,
        url: animeData.seriesUrl || canonicalUrl,
        genre: animeData.genres || []
      },
      inLanguage: ['id', 'ja'],
      potentialAction: {
        '@type': 'WatchAction',
        target: canonicalUrl
      }
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: animeData.title,
    description: animeData.description || `Streaming anime ${animeData.title} subtitle Indonesia gratis di Ndichan.`,
    image: poster,
    url: canonicalUrl,
    datePublished: animeData.releaseDate || undefined,
    genre: animeData.genres || [],
    inLanguage: ['id', 'ja'],
    aggregateRating: animeData.rating && animeData.rating !== '0' ? {
      '@type': 'AggregateRating',
      ratingValue: String(animeData.rating),
      bestRating: '10',
      worstRating: '1',
      ratingCount: animeData.ratingCount || '1250'
    } : undefined,
    potentialAction: {
      '@type': 'WatchAction',
      target: canonicalUrl
    }
  };
};

// Schema Markup untuk Detail Manga / Komik
export const getMangaSchema = (mangaData = {}) => {
  const canonicalUrl = mangaData.url || SITE_URL;
  const poster = mangaData.image || DEFAULT_OG_IMAGE;

  return {
    '@context': 'https://schema.org',
    '@type': 'ComicSeries',
    name: mangaData.title,
    description: mangaData.description || `Baca komik ${mangaData.title} bahasa Indonesia gratis di Ndichan.`,
    image: poster,
    url: canonicalUrl,
    genre: mangaData.genres || [],
    author: mangaData.author ? {
      '@type': 'Person',
      name: mangaData.author
    } : undefined,
    inLanguage: 'id',
    aggregateRating: mangaData.rating && mangaData.rating !== '0' ? {
      '@type': 'AggregateRating',
      ratingValue: String(mangaData.rating),
      bestRating: '10',
      worstRating: '1',
      ratingCount: mangaData.ratingCount || '890'
    } : undefined,
    potentialAction: {
      '@type': 'ReadAction',
      target: canonicalUrl
    }
  };
};

// Schema Markup untuk Reader / Chapter Komik
export const getChapterSchema = (chapterData = {}) => {
  const canonicalUrl = chapterData.url || SITE_URL;
  const poster = chapterData.image || DEFAULT_OG_IMAGE;

  return {
    '@context': 'https://schema.org',
    '@type': 'ComicIssue',
    name: `${chapterData.mangaTitle || chapterData.title} Chapter ${chapterData.chapterNum || ''}`,
    description: `Baca ${chapterData.mangaTitle || chapterData.title} Chapter ${chapterData.chapterNum} subtitle Indonesia secara online gratis di Ndichan.`,
    image: poster,
    url: canonicalUrl,
    issueNumber: String(chapterData.chapterNum || '1'),
    partOfSeries: {
      '@type': 'ComicSeries',
      name: chapterData.mangaTitle || chapterData.title,
      url: chapterData.mangaUrl || canonicalUrl
    },
    inLanguage: 'id',
    potentialAction: {
      '@type': 'ReadAction',
      target: canonicalUrl
    }
  };
};

// Schema Markup untuk Listing / Koleksi (Home, Ongoing, Populer, dll)
export const getCollectionSchema = (collectionData = {}) => {
  const { name, description, url, items = [] } = collectionData;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: url || SITE_URL,
    mainEntity: items.length > 0 ? {
      '@type': 'ItemList',
      itemListElement: items.slice(0, 30).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
        image: item.image || undefined
      }))
    } : undefined
  };
};
