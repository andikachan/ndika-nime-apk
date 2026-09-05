package com.ndikanime.app.data.api

import com.ndikanime.app.NdikaNimeApp
import com.ndikanime.app.data.storage.AuthManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private const val ANIME_BASE_URL = "https://api.ndikacunk.my.id/v1/"

    private val authManager by lazy { AuthManager(NdikaNimeApp.instance) }

    private val loggingInterceptor by lazy {
        HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
    }

    private val okHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(loggingInterceptor)
            .addInterceptor { chain ->
                val original = chain.request()
                val requestBuilder = original.newBuilder()
                    .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36")
                    .header("Accept", "application/json")
                    .method(original.method, original.body)

                // Inject JWT Token if user is logged in
                authManager.token?.let { token ->
                    requestBuilder.header("Authorization", "Bearer $token")
                    requestBuilder.header("Cookie", "token=$token")
                }

                chain.proceed(requestBuilder.build())
            }
            .build()
    }

    val service: AnimeApiService by lazy {
        Retrofit.Builder()
            .baseUrl(ANIME_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AnimeApiService::class.java)
    }

    val communityService: CommunityApiService by lazy {
        Retrofit.Builder()
            .baseUrl(ANIME_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(CommunityApiService::class.java)
    }
}
