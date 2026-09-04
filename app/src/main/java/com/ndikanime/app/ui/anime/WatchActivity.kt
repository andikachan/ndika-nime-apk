package com.ndikanime.app.ui.anime

import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.EpisodeDetailData
import com.ndikanime.app.data.model.ServerItem
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.storage.HistoryStorage
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.ActivityWatchBinding
import com.ndikanime.app.ui.community.CommentsBottomSheet
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class WatchActivity : AppCompatActivity() {

    private lateinit var binding: ActivityWatchBinding
    private var exoPlayer: ExoPlayer? = null
    private val historyStorage by lazy { HistoryStorage(this) }
    private val authManager by lazy { AuthManager(this) }
    private var watchTimeTrackingJob: Job? = null

    private var episodeId: String = ""
    private var episodeTitle: String = ""
    private var animeId: String = ""
    private var animeTitle: String = ""
    private var animePoster: String = ""

    private var currentServers: List<ServerItem> = emptyList()
    private var selectedServer: ServerItem? = null
    private var nextEpisodeId: String? = null
    private var nextEpisodeTitle: String? = null

    private var currentSpeed: Float = 1.0f
    private var isFullscreen: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        binding = ActivityWatchBinding.inflate(layoutInflater)
        setContentView(binding.root)

        episodeId = intent.getStringExtra("episode_id") ?: ""
        episodeTitle = intent.getStringExtra("episode_title") ?: ""
        animeId = intent.getStringExtra("anime_id") ?: ""
        animeTitle = intent.getStringExtra("anime_title") ?: ""
        animePoster = intent.getStringExtra("anime_poster") ?: ""

        initPlayer()
        setupCustomControls()

        loadEpisode(episodeId)
    }

    private fun initPlayer() {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                15000, // minBufferMs
                50000, // maxBufferMs
                1500,  // bufferForPlaybackMs
                3000   // bufferForPlaybackAfterRebufferMs
            )
            .build()

        exoPlayer = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .setSeekForwardIncrementMs(10000)
            .setSeekBackIncrementMs(10000)
            .build().apply {
                playWhenReady = true
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        if (isPlaying) {
                            startWatchTimeTracker()
                        } else {
                            stopWatchTimeTracker()
                        }
                    }

                    override fun onPlaybackStateChanged(state: Int) {
                        when (state) {
                            Player.STATE_BUFFERING -> binding.pbWatchLoading.visibility = View.VISIBLE
                            Player.STATE_READY -> binding.pbWatchLoading.visibility = View.GONE
                            Player.STATE_ENDED -> {
                                binding.pbWatchLoading.visibility = View.GONE
                                playNextEpisode()
                            }
                            Player.STATE_IDLE -> {}
                        }
                    }
                })
            }
        binding.playerView.player = exoPlayer
    }

    private fun setupCustomControls() {
        val btnBack = binding.playerView.findViewById<ImageButton>(R.id.btnBackPlayer)
        val tvTitle = binding.playerView.findViewById<TextView>(R.id.tvPlayerTitle)
        val btnQuality = binding.playerView.findViewById<TextView>(R.id.btnQuality)
        val btnSpeed = binding.playerView.findViewById<TextView>(R.id.btnSpeed)
        val btnRewind = binding.playerView.findViewById<ImageButton>(R.id.btnRewind)
        val btnForward = binding.playerView.findViewById<ImageButton>(R.id.btnForward)
        val btnFullscreen = binding.playerView.findViewById<ImageButton>(R.id.btnFullscreen)
        val btnEpisodeList = binding.playerView.findViewById<ImageButton>(R.id.btnEpisodeList)
        val btnComments = binding.playerView.findViewById<ImageButton>(R.id.btnComments)

        btnBack?.setOnClickListener { finish() }
        tvTitle?.text = if (animeTitle.isNotBlank()) "$animeTitle - $episodeTitle" else episodeTitle

        btnComments?.setOnClickListener {
            val target = if (episodeId.isNotBlank()) episodeId else animeId
            if (target.isNotBlank()) {
                CommentsBottomSheet(this, "anime", target).show()
            } else {
                Toast.makeText(this, "Episode belum dipilih", Toast.LENGTH_SHORT).show()
            }
        }

        btnRewind?.setOnClickListener {
            exoPlayer?.seekBack()
        }

        btnForward?.setOnClickListener {
            exoPlayer?.seekForward()
        }

        btnQuality?.setOnClickListener {
            showQualityDialog()
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

        btnEpisodeList?.setOnClickListener {
            if (nextEpisodeId != null) {
                playNextEpisode()
            } else {
                Toast.makeText(this, "Tidak ada episode berikutnya", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun toggleFullscreen() {
        val btnFullscreen = binding.playerView.findViewById<ImageButton>(R.id.btnFullscreen)
        if (isFullscreen) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            btnFullscreen?.setImageResource(R.drawable.ic_fullscreen)
            isFullscreen = false
        } else {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            btnFullscreen?.setImageResource(R.drawable.ic_fullscreen_exit)
            isFullscreen = true
        }
    }

    private fun loadEpisode(epId: String) {
        binding.pbWatchLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getEpisode(epId)
                if (res.status && res.data != null) {
                    val data = res.data
                    bindEpisodeData(data)
                } else {
                    Toast.makeText(this@WatchActivity, "Server video tidak ditemukan", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@WatchActivity, "Gagal memuat video: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.pbWatchLoading.visibility = View.GONE
            }
        }
    }

    private var currentEpisodeIndex: String? = null

    private fun bindEpisodeData(data: EpisodeDetailData) {
        currentEpisodeIndex = data.episode?.index
        val servers = (data.server ?: emptyList()).filter { s ->
            !s.link.isNullOrBlank() && !s.quality.isNullOrBlank() && s.type == "direct"
        }
        currentServers = if (servers.isNotEmpty()) servers else (data.server ?: emptyList())

        nextEpisodeId = data.nextEpisode?.id
        nextEpisodeTitle = data.nextEpisode?.title

        selectedServer = currentServers.find { it.quality == "720p" }
            ?: currentServers.find { it.quality == "480p" }
            ?: currentServers.firstOrNull()

        selectedServer?.let { playServer(it, 0L) }
    }

    private fun playServer(server: ServerItem, seekToMs: Long) {
        selectedServer = server
        val btnQuality = binding.playerView.findViewById<TextView>(R.id.btnQuality)
        btnQuality?.text = server.quality ?: "AUTO"

        val streamUrl = server.getStreamingUrl()
        if (streamUrl.isNotBlank()) {
            val mediaItem = MediaItem.fromUri(Uri.parse(streamUrl))
            exoPlayer?.setMediaItem(mediaItem)
            exoPlayer?.prepare()
            if (seekToMs > 0) {
                exoPlayer?.seekTo(seekToMs)
            }
            exoPlayer?.play()
        }
    }

    private fun showQualityDialog() {
        if (currentServers.isEmpty()) return
        val qualities = currentServers.map { "${it.quality} (${it.name ?: "Server"})" }.toTypedArray()
        val currentIndex = currentServers.indexOf(selectedServer).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle(R.string.server_resolution)
            .setSingleChoiceItems(qualities, currentIndex) { dialog, which ->
                val chosen = currentServers[which]
                val currentPos = exoPlayer?.currentPosition ?: 0L
                playServer(chosen, currentPos)
                dialog.dismiss()
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    private fun playNextEpisode() {
        val nextId = nextEpisodeId ?: return
        episodeTitle = nextEpisodeTitle ?: "Episode Berikutnya"
        episodeId = nextId
        binding.playerView.findViewById<TextView>(R.id.tvPlayerTitle)?.text =
            "$animeTitle - $episodeTitle"
        loadEpisode(episodeId)
    }

    private fun startWatchTimeTracker() {
        val uid = authManager.userId ?: return
        if (watchTimeTrackingJob?.isActive == true) return
        watchTimeTrackingJob = lifecycleScope.launch {
            while (isActive) {
                delay(20000)
                if (exoPlayer?.isPlaying == true) {
                    try {
                        val result = UpstashRepository.addWatchTime(uid, 20)
                        if (result.levelUp) {
                            authManager.getUserProfile()?.let { p ->
                                authManager.saveUser(
                                    p.copy(
                                        level = result.newLevel,
                                        title = result.newTitle,
                                        watchTime = result.watchTime,
                                        coins = p.coins + result.coinsEarned
                                    )
                                )
                            }
                            Toast.makeText(
                                this@WatchActivity,
                                "Level Up! Kamu sekarang Level ${result.newLevel} (${result.newTitle})! +${result.coinsEarned} Koin",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    } catch (e: Exception) {}
                }
            }
        }
    }

    private fun stopWatchTimeTracker() {
        watchTimeTrackingJob?.cancel()
        watchTimeTrackingJob = null
    }

    private fun saveProgress() {
        val pos = exoPlayer?.currentPosition ?: 0L
        if (animeId.isNotBlank() && animeTitle.isNotBlank()) {
            historyStorage.saveAnimeHistory(
                id = animeId,
                title = animeTitle,
                cover = animePoster,
                episodeTitle = episodeTitle,
                episodeIndex = currentEpisodeIndex,
                progressMs = pos
            )
        }
    }

    override fun onPause() {
        super.onPause()
        stopWatchTimeTracker()
        saveProgress()
        exoPlayer?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopWatchTimeTracker()
        saveProgress()
        exoPlayer?.release()
        exoPlayer = null
    }
}
