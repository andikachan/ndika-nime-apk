/**
 * Service API terpusat untuk data Anime & Manga.
 * Mendukung konfigurasi via VITE_ANIME_API_BASE jika ingin switch endpoint tanpa edit kode.
 */

const BASE_URL = import.meta.env.VITE_ANIME_API_BASE || '/ndikagantengtobrutbanget/v1';

async function fetchJson(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[AnimeApi Error] Failed fetching ${url}:`, err);
    throw err;
  }
}

export const animeApi = {
  getSchedule: () => fetchJson('/schedule'),
  getOngoing: (page = 0) => fetchJson(`/ongoing?page=${page}`),
  getPopular: (page = 1) => fetchJson(`/popular?page=${page}`),
  getNew: (page = 1, limit = 20) => fetchJson(`/new?page=${page}&limit=${limit}`),
  getDetail: (id) => fetchJson(`/detail?id=${encodeURIComponent(id)}`),
  getEpisode: (id) => fetchJson(`/episode?id=${encodeURIComponent(id)}`),
  search: (query, page = 0) => fetchJson(`/search?q=${encodeURIComponent(query)}&page=${page}`),
  getGenres: () => fetchJson('/genre'),
  getByGenre: (genreId, page = 0) => fetchJson(`/genre?id=${encodeURIComponent(genreId)}&page=${page}`),
};

export const mangaApi = {
  getHeroSlider: (limit = 15) => fetchJson(`/manga/heroslider?limit=${limit}`),
  getPopularToday: (limit = 45) => fetchJson(`/manga/populartoday?limit=${limit}`),
  getLatest: (params = '') => fetchJson(`/manga/latest?${params}`),
  getLatestProject: () => fetchJson('/manga/latestproject'),
  getAllComics: (params = '') => fetchJson(`/manga/allcomics?${params}`),
  filter: (params = '') => fetchJson(`/manga/filter?${params}`),
  search: (query) => fetchJson(`/manga/search?q=${encodeURIComponent(query)}`),
  getDetail: (slug) => fetchJson(`/manga/detail?slug=${encodeURIComponent(slug)}`),
  readChapter: (slug) => fetchJson(`/manga/read?slug=${encodeURIComponent(slug)}`),
};

export default { animeApi, mangaApi, BASE_URL };
