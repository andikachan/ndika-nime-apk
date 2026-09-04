package com.ndikanime.app.ui.community

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.ndikanime.app.data.model.CommentItem
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.DialogCommentsBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CommentsBottomSheet(
    private val context: Context,
    private val type: String,
    private val targetId: String
) {
    private val authManager = AuthManager(context)
    private val dialog = BottomSheetDialog(context)
    private val binding = DialogCommentsBinding.inflate(LayoutInflater.from(context))
    private val commentsList = mutableListOf<CommentItem>()
    private val adapter = CommentAdapter(commentsList)

    init {
        dialog.setContentView(binding.root)
        binding.rvComments.layoutManager = LinearLayoutManager(context)
        binding.rvComments.adapter = adapter

        binding.btnCloseComments.setOnClickListener { dialog.dismiss() }

        binding.btnSendComment.setOnClickListener {
            postComment()
        }

        loadComments()
    }

    fun show() {
        dialog.show()
    }

    private fun loadComments() {
        binding.pbCommentsLoading.visibility = View.VISIBLE
        binding.tvEmptyComments.visibility = View.GONE

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val list = withContext(Dispatchers.IO) {
                    UpstashRepository.getComments(type, targetId)
                }
                commentsList.clear()
                commentsList.addAll(list)
                adapter.notifyDataSetChanged()

                if (commentsList.isEmpty()) {
                    binding.tvEmptyComments.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal memuat komentar", Toast.LENGTH_SHORT).show()
            } finally {
                binding.pbCommentsLoading.visibility = View.GONE
            }
        }
    }

    private fun postComment() {
        val text = binding.etCommentInput.text.toString().trim()
        if (text.isBlank()) return

        if (!authManager.isLoggedIn) {
            Toast.makeText(context, "Silakan login terlebih dahulu untuk komentar", Toast.LENGTH_SHORT).show()
            return
        }

        val user = authManager.getUserProfile() ?: UserProfile(
            id = authManager.userId ?: "user",
            name = authManager.userName ?: "User",
            picture = authManager.userAvatar
        )

        binding.etCommentInput.setText("")

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val comment = withContext(Dispatchers.IO) {
                    UpstashRepository.postComment(type, targetId, user, text)
                }
                commentsList.add(comment)
                adapter.notifyItemInserted(commentsList.size - 1)
                binding.rvComments.scrollToPosition(commentsList.size - 1)
                binding.tvEmptyComments.visibility = View.GONE
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal mengirim komentar", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
