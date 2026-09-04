package com.ndikanime.app.data.api

import com.ndikanime.app.data.model.*
import retrofit2.http.*

interface CommunityApiService {

    @GET("user/leaderboard")
    suspend fun getLeaderboard(): LeaderboardResponse

    @GET("social/chat")
    suspend fun getChatMessages(
        @Query("limit") limit: Int = 50
    ): ChatResponse

    @POST("social/chat")
    suspend fun sendChatMessage(
        @Body body: SendChatRequest
    ): ChatResponse

    @GET("w2g/rooms")
    suspend fun getW2GRooms(): W2GResponse

    @POST("w2g/create")
    suspend fun createW2GRoom(
        @Body body: CreateW2GRoomRequest
    ): W2GResponse

    @POST("auth/login")
    suspend fun login(
        @Body body: LoginRequest
    ): AuthResponse

    @POST("auth/register")
    suspend fun register(
        @Body body: RegisterRequest
    ): AuthResponse

    @GET("auth/me")
    suspend fun getMe(): AuthResponse
}
