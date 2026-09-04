package com.ndikanime.app.ui.community

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.*
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.databinding.ActivityW2gRoomBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs

class W2GRoomActivity : AppCompatActivity() {

    private lateinit var binding: ActivityW2gRoomBinding
    private val authManager by lazy { AuthManager(this) }

    private var exoPlayer: ExoPlayer? = null
    private var roomId: String = ""
    private var passcode: String = ""
    private var isHost: Boolean = false
    private var currentRoom: W2GRoomDetail? = null

    private val chatAdapter by lazy { W2GChatAdapter() }
    private val memberAdapter by lazy { W2GMemberAdapter() }
    private val chatMessages = mutableListOf<W2GChatItem>()

    private var heartbeatJob: Job? = null
    private var isSelfUpdating = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityW2gRoomBinding.inflate(layoutInflater)
        setContentView(binding.root)

        roomId = intent.getStringExtra("room_id") ?: ""
        passcode = intent.getStringExtra("passcode") ?: ""

        if (roomId.isBlank()) {
            Toast.makeText(this, "ID Room tidak valid", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupViews()
        initPlayer()
        joinRoom()
    }

    private fun setupViews() {
        binding.btnLeaveW2G.setOnClickListener { finish() }

        binding.btnCopyRoomCode.setOnClickListener {
            val clip = ClipData.newPlainText("W2G Room Code", roomId)
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(clip)
            Toast.makeText(this, "Kode room $roomId disalin!", Toast.LENGTH_SHORT).show()
        }

        binding.rvW2GChat.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        binding.rvW2GChat.adapter = chatAdapter

        binding.rvW2GMembers.layoutManager = LinearLayoutManager(this)
        binding.rvW2GMembers.adapter = memberAdapter

        binding.tabW2GRoom.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                val isChat = tab?.position == 0
                binding.layoutW2GChatTab.visibility = if (isChat) View.VISIBLE else View.GONE
                binding.rvW2GMembers.visibility = if (isChat) View.GONE else View.VISIBLE
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.btnSendW2GChat.setOnClickListener {
            sendChat()
        }
    }

    private fun initPlayer() {
        exoPlayer = ExoPlayer.Builder(this).build()
        binding.playerViewW2G.player = exoPlayer

        exoPlayer?.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isHost && !isSelfUpdating) {
                    syncHostState()
                }
            }

            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo,
                newPosition: Player.PositionInfo,
                reason: Int
            ) {
                if (isHost && !isSelfUpdating && reason == Player.DISCONTINUITY_REASON_SEEK) {
                    syncHostState()
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                binding.pbW2GVideoLoading.visibility =
                    if (playbackState == Player.STATE_BUFFERING) View.VISIBLE else View.GONE
            }
        })
    }

    private fun joinRoom() {
        binding.pbW2GVideoLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.community.getW2GRoomDetail(roomId, passcode)
                if (res.success && res.room != null) {
                    currentRoom = res.room
                    isHost = res.isHost
                    bindRoomInfo(res.room, res.members ?: emptyList(), res.chat ?: emptyList())
                    startHeartbeatLoop()
                } else {
                    Toast.makeText(this@W2GRoomActivity, res.error ?: "Gagal masuk room", Toast.LENGTH_LONG).show()
                    finish()
                }
            } catch (e: Exception) {
                Toast.makeText(this@W2GRoomActivity, "Koneksi gagal: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                finish()
            } finally {
                binding.pbW2GVideoLoading.visibility = View.GONE
            }
        }
    }

    private fun bindRoomInfo(
        room: W2GRoomDetail,
        members: List<W2GMember>,
        initialChat: List<W2GChatItem>
    ) {
        binding.tvW2GRoomTitle.text = room.title ?: "Room Nonton Bareng"
        binding.tvW2GRoomSubtitle.text = "${room.animeTitle ?: "Video"} • Ep ${room.episodeIndex ?: "1"} [${room.id}]"
        binding.tvSyncBadge.text = if (isHost) "● Anda adalah Host" else "● Sinkronisasi Host"

        memberAdapter.submitList(members)

        chatMessages.clear()
        chatMessages.addAll(initialChat)
        chatAdapter.submitList(chatMessages.toList())
        if (chatMessages.isNotEmpty()) {
            binding.rvW2GChat.scrollToPosition(chatMessages.size - 1)
        }

        // Set video URL
        val rawUrl = room.videoUrl
        if (!rawUrl.isNullOrBlank()) {
            val streamUrl = if (rawUrl.contains("cfelainawanggy.pages.dev")) {
                rawUrl.replace("action=proxy", "action=stream")
            } else {
                "https://cfelainawanggy.pages.dev/?action=stream&url=" + java.net.URLEncoder.encode(rawUrl, "UTF-8")
            }
            val mediaItem = MediaItem.fromUri(Uri.parse(streamUrl))
            exoPlayer?.setMediaItem(mediaItem)
            exoPlayer?.prepare()

            val startSec = room.estimatedTime.takeIf { it > 0 } ?: room.currentTime
            if (startSec > 0) {
                exoPlayer?.seekTo((startSec * 1000).toLong())
            }
            if (room.isPlaying) {
                exoPlayer?.play()
            } else {
                exoPlayer?.pause()
            }
        }
    }

    private fun syncHostState() {
        val player = exoPlayer ?: return
        val currentSec = player.currentPosition / 1000.0
        val isPlaying = player.isPlaying

        lifecycleScope.launch {
            try {
                ApiClient.community.syncW2G(
                    W2GSyncRequest(
                        roomId = roomId,
                        isPlaying = isPlaying,
                        currentTime = currentSec
                    )
                )
            } catch (e: Exception) {}
        }
    }

    private fun startHeartbeatLoop() {
        heartbeatJob = lifecycleScope.launch {
            while (isActive) {
                try {
                    val currentSec = (exoPlayer?.currentPosition ?: 0L) / 1000.0
                    val lastSeq = chatMessages.mapNotNull { it.seq }.maxOrNull() ?: 0L

                    val res = ApiClient.community.sendW2GHeartbeat(
                        W2GHeartbeatRequest(
                            roomId = roomId,
                            lastSeq = lastSeq,
                            userCurrentTime = currentSec
                        )
                    )

                    if (res.success) {
                        isHost = res.isHost
                        binding.tvSyncBadge.text = if (isHost) "● Anda adalah Host" else "● Sinkronisasi Host"

                        res.members?.let { memberAdapter.submitList(it) }

                        // Append new chat messages
                        val newItems = res.newChat ?: emptyList()
                        if (newItems.isNotEmpty()) {
                            val existingIds = chatMessages.mapNotNull { it.id }.toSet()
                            val filtered = newItems.filter { it.id !in existingIds }
                            if (filtered.isNotEmpty()) {
                                chatMessages.addAll(filtered)
                                chatAdapter.submitList(chatMessages.toList())
                                binding.rvW2GChat.smoothScrollToPosition(chatMessages.size - 1)
                            }
                        }

                        // Playback synchronization for non-host
                        val playback = res.playback
                        if (!isHost && playback != null && exoPlayer != null) {
                            val player = exoPlayer!!
                            val targetSec = playback.currentTime
                            val playerSec = player.currentPosition / 1000.0

                            isSelfUpdating = true
                            if (abs(playerSec - targetSec) > 2.5) {
                                player.seekTo((targetSec * 1000).toLong())
                            }
                            if (playback.isPlaying && !player.isPlaying) {
                                player.play()
                            } else if (!playback.isPlaying && player.isPlaying) {
                                player.pause()
                            }
                            isSelfUpdating = false
                        }
                    }
                } catch (e: Exception) {
                    // silent polling error
                }
                delay(3000)
            }
        }
    }

    private fun sendChat() {
        val text = binding.etW2GChatMessage.text.toString().trim()
        if (text.isBlank()) return

        val currentSec = (exoPlayer?.currentPosition ?: 0L) / 1000.0
        binding.etW2GChatMessage.setText("")

        // Optimistic local add
        val now = System.currentTimeMillis()
        val localMsg = W2GChatItem(
            id = "local_$now",
            userId = authManager.userId ?: "guest",
            userName = authManager.userName ?: "Tamu",
            userAvatar = authManager.userAvatar,
            text = text,
            timestamp = now
        )
        chatMessages.add(localMsg)
        chatAdapter.submitList(chatMessages.toList())
        binding.rvW2GChat.scrollToPosition(chatMessages.size - 1)

        lifecycleScope.launch {
            try {
                ApiClient.community.sendW2GChat(
                    W2GChatRequest(
                        roomId = roomId,
                        text = text,
                        videoTime = currentSec
                    )
                )
            } catch (e: Exception) {
                Toast.makeText(this@W2GRoomActivity, "Gagal mengirim komentar", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        heartbeatJob?.cancel()
        val currentRoomId = roomId
        if (currentRoomId.isNotBlank()) {
            kotlinx.coroutines.GlobalScope.launch {
                try {
                    ApiClient.community.leaveW2G(mapOf("roomId" to currentRoomId))
                } catch (e: Exception) {}
            }
        }
        exoPlayer?.release()
        exoPlayer = null
    }
}
