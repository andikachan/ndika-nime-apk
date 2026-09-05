package com.ndikanime.app.ui.community

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.R
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
    private var isFullscreen = false
    private var currentSpeed = 1.0f

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
        setupCustomControls()
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
                val btnPlayPause = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnPlayPause)
                btnPlayPause?.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
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
                val btnPlayPause = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnPlayPause)
                btnPlayPause?.setImageResource(if (exoPlayer?.isPlaying == true) R.drawable.ic_pause else R.drawable.ic_play)
                binding.pbW2GVideoLoading.visibility =
                    if (playbackState == Player.STATE_BUFFERING) View.VISIBLE else View.GONE
            }
        })
    }

    private fun setupCustomControls() {
        val btnBack = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnBackPlayer)
        val tvTitle = binding.playerViewW2G.findViewById<TextView>(R.id.tvPlayerTitle)
        val btnPlayPause = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnPlayPause)
        val btnRewind = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnRewind)
        val btnForward = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnForward)
        val btnSpeed = binding.playerViewW2G.findViewById<TextView>(R.id.btnSpeed)
        val btnFullscreen = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnFullscreen)
        val btnComments = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnComments)
        val btnEpisodeList = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnEpisodeList)
        val btnQuality = binding.playerViewW2G.findViewById<TextView>(R.id.btnQuality)

        btnEpisodeList?.visibility = View.GONE
        btnQuality?.visibility = View.GONE

        btnBack?.setOnClickListener { finish() }

        btnPlayPause?.setOnClickListener {
            if (isHost) {
                val player = exoPlayer ?: return@setOnClickListener
                if (player.isPlaying) {
                    player.pause()
                } else {
                    player.play()
                }
                syncHostState()
            } else {
                Toast.makeText(this, "Hanya Host yang dapat mengatur pemutaran", Toast.LENGTH_SHORT).show()
            }
        }

        binding.playerViewW2G.setControllerVisibilityListener(androidx.media3.ui.PlayerView.ControllerVisibilityListener { visibility ->
            if (visibility == View.VISIBLE) {
                btnPlayPause?.setImageResource(if (exoPlayer?.isPlaying == true) R.drawable.ic_pause else R.drawable.ic_play)
            }
        })

        btnComments?.setOnClickListener {
            binding.tabW2GRoom.getTabAt(0)?.select()
        }

        btnRewind?.setOnClickListener {
            if (isHost) {
                exoPlayer?.let { p ->
                    p.seekTo(maxOf(0L, p.currentPosition - 10000L))
                    syncHostState()
                }
            } else {
                Toast.makeText(this, "Hanya Host yang dapat mengatur pemutaran", Toast.LENGTH_SHORT).show()
            }
        }

        btnForward?.setOnClickListener {
            if (isHost) {
                exoPlayer?.let { p ->
                    p.seekTo(minOf(p.duration, p.currentPosition + 10000L))
                    syncHostState()
                }
            } else {
                Toast.makeText(this, "Hanya Host yang dapat mengatur pemutaran", Toast.LENGTH_SHORT).show()
            }
        }

        val speeds = listOf(1.0f, 1.25f, 1.5f, 2.0f, 0.75f)
        btnSpeed?.setOnClickListener {
            val nextIndex = (speeds.indexOf(currentSpeed) + 1) % speeds.size
            currentSpeed = speeds[nextIndex]
            exoPlayer?.playbackParameters = PlaybackParameters(currentSpeed)
            btnSpeed.text = "${currentSpeed}x"
        }

        btnFullscreen?.setOnClickListener {
            toggleFullscreen()
        }
    }

    private fun toggleFullscreen() {
        val btnFullscreen = binding.playerViewW2G.findViewById<ImageButton>(R.id.btnFullscreen)
        if (isFullscreen) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            btnFullscreen?.setImageResource(R.drawable.ic_fullscreen)
            binding.topBarW2G.visibility = View.VISIBLE
            binding.tabW2GRoom.visibility = View.VISIBLE
            binding.layoutW2GChatTab.visibility = if (binding.tabW2GRoom.selectedTabPosition == 0) View.VISIBLE else View.GONE
            binding.rvW2GMembers.visibility = if (binding.tabW2GRoom.selectedTabPosition == 1) View.VISIBLE else View.GONE
            isFullscreen = false
        } else {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            btnFullscreen?.setImageResource(R.drawable.ic_fullscreen_exit)
            binding.topBarW2G.visibility = View.GONE
            binding.tabW2GRoom.visibility = View.GONE
            binding.layoutW2GChatTab.visibility = View.GONE
            binding.rvW2GMembers.visibility = View.GONE
            isFullscreen = true
        }
    }

    private fun joinRoom() {
        binding.pbW2GVideoLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = com.ndikanime.app.data.upstash.UpstashRepository.getW2GRoomDetail(roomId, passcode)
                if (res.success && res.room != null) {
                    currentRoom = res.room
                    val myId = authManager.userId
                    isHost = res.room.hostId == myId || res.isHost
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
        binding.playerViewW2G.findViewById<TextView>(R.id.tvPlayerTitle)?.text = "${room.animeTitle ?: room.title ?: "W2G"} - Ep ${room.episodeIndex ?: "1"}"
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
                com.ndikanime.app.data.upstash.UpstashRepository.syncW2GPlayback(roomId, isPlaying, currentSec)
            } catch (e: Exception) {}
        }
    }

    private fun startHeartbeatLoop() {
        heartbeatJob = lifecycleScope.launch {
            while (isActive) {
                try {
                    val currentSec = (exoPlayer?.currentPosition ?: 0L) / 1000.0
                    val lastSeq = chatMessages.mapNotNull { it.seq }.maxOrNull() ?: 0L
                    val user = authManager.getUserProfile() ?: UserProfile(
                        id = authManager.userId ?: "guest",
                        name = authManager.userName ?: "Tamu",
                        picture = authManager.userAvatar
                    )

                    val res = com.ndikanime.app.data.upstash.UpstashRepository.sendW2GHeartbeat(
                        roomId,
                        user,
                        currentSec,
                        lastSeq
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

        val user = authManager.getUserProfile() ?: UserProfile(
            id = authManager.userId ?: "guest",
            name = authManager.userName ?: "Tamu",
            picture = authManager.userAvatar
        )

        lifecycleScope.launch {
            try {
                com.ndikanime.app.data.upstash.UpstashRepository.sendW2GChat(roomId, user, text, currentSec)
            } catch (e: Exception) {
                Toast.makeText(this@W2GRoomActivity, "Gagal mengirim komentar", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        heartbeatJob?.cancel()
        val currentRoomId = roomId
        val currentUserId = authManager.userId ?: "guest"
        if (currentRoomId.isNotBlank()) {
            kotlinx.coroutines.GlobalScope.launch {
                try {
                    com.ndikanime.app.data.upstash.UpstashRepository.leaveW2G(currentRoomId, currentUserId)
                } catch (e: Exception) {}
            }
        }
        exoPlayer?.release()
        exoPlayer = null
    }
}
