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

    @GET("w2g/room")
    suspend fun getW2GRoomDetail(
        @Query("id") id: String,
        @Query("passcode") passcode: String = ""
    ): W2GRoomDetailResponse

    @POST("w2g/sync")
    suspend fun syncW2G(
        @Body body: W2GSyncRequest
    ): W2GGenericResponse

    @GET("w2g/syncState")
    suspend fun getW2GSyncState(
        @Query("id") id: String
    ): W2GSyncStateResponse

    @POST("w2g/chat")
    suspend fun sendW2GChat(
        @Body body: W2GChatRequest
    ): W2GGenericResponse

    @POST("w2g/heartbeat")
    suspend fun sendW2GHeartbeat(
        @Body body: W2GHeartbeatRequest
    ): W2GHeartbeatResponse

    @POST("w2g/leave")
    suspend fun leaveW2G(
        @Body body: Map<String, String>
    ): W2GGenericResponse

    // ===== HISTORY =====
    @GET("history")
    suspend fun getHistory(): RemoteHistoryResponse

    @POST("history")
    suspend fun postHistory(
        @Body body: HistoryPostPayload
    ): RemoteHistoryResponse

    @HTTP(method = "DELETE", path = "history", hasBody = true)
    suspend fun deleteHistory(
        @Body body: HistoryDeletePayload
    ): RemoteHistoryResponse

    // ===== AUTH & PROFILE =====
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

    @POST("user/avatar")
    suspend fun updateProfile(
        @Body body: Map<String, String>
    ): AuthResponse
}
