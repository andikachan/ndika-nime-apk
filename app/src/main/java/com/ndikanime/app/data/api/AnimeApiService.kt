package com.ndikanime.app.data.api

import com.ndikanime.app.data.model.*
import retrofit2.http.GET
import retrofit2.http.Query

interface AnimeApiService {

    @GET("ongoing")
    suspend fun getOngoing(@Query("page") page: Int = 1): AnimeListResponse

    @GET("popular")
    suspend fun getPopular(@Query("page") page: Int = 1): AnimeListResponse

    @GET("new")
    suspend fun getNew(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): AnimeListResponse

    @GET("schedule")
    suspend fun getSchedule(): ScheduleResponse

    @GET("detail")
    suspend fun getDetail(@Query("id") id: String): AnimeDetailResponse

    @GET("episode")
    suspend fun getEpisode(@Query("id") id: String): EpisodeDetailResponse

    @GET("search")
    suspend fun searchAnime(
        @Query("q") query: String,
        @Query("page") page: Int = 0
    ): AnimeListResponse

    @GET("genre")
    suspend fun getGenres(): GenreListResponse

    @GET("genre")
    suspend fun getAnimeByGenre(
        @Query("id") genreId: String,
        @Query("page") page: Int = 0
    ): AnimeListResponse

    // Manga
    @GET("manga/populartoday")
    suspend fun getMangaPopularToday(@Query("limit") limit: Int = 30): MangaListResponse

    @GET("manga/latest")
    suspend fun getMangaLatest(): MangaListResponse

    @GET("manga/detail")
    suspend fun getMangaDetail(@Query("slug") slug: String): MangaDetailResponse

    @GET("manga/read")
    suspend fun getMangaRead(@Query("slug") slug: String): MangaReadResponse

    @GET("manga/search")
    suspend fun searchManga(@Query("q") query: String): MangaListResponse
}
