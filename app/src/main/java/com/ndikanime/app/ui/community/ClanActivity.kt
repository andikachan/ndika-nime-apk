package com.ndikanime.app.ui.community

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.button.MaterialButton
import com.ndikanime.app.R
import com.ndikanime.app.data.model.ClanItem
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.ActivityClanBinding
import kotlinx.coroutines.launch

class ClanActivity : AppCompatActivity() {

    private lateinit var binding: ActivityClanBinding
    private val authManager by lazy { AuthManager(this) }
    private val clanList = mutableListOf<ClanItem>()
    private var myClan: ClanItem? = null

    private val adapter by lazy {
        ClanAdapter(clanList) { clan ->
            joinClan(clan)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityClanBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBackClan.setOnClickListener { finish() }

        binding.rvClanList.layoutManager = LinearLayoutManager(this)
        binding.rvClanList.adapter = adapter

        binding.btnCreateClan.setOnClickListener {
            showCreateClanDialog()
        }

        binding.btnLeaveMyClan.setOnClickListener {
            leaveMyClan()
        }

        loadClanData()
    }

    private fun loadClanData() {
        val uid = authManager.userId ?: return
        binding.pbClanLoading.visibility = View.VISIBLE
        binding.tvEmptyClans.visibility = View.GONE

        lifecycleScope.launch {
            try {
                myClan = UpstashRepository.getMyClan(uid)
                if (myClan != null) {
                    binding.cardMyClan.visibility = View.VISIBLE
                    binding.tvMyClanName.text = "${myClan?.name} [${myClan?.tag}]"
                    binding.tvMyClanDesc.text = myClan?.description
                    binding.tvMyClanStats.text = "Level ${myClan?.level} • ${myClan?.memberCount} Anggota"
                    binding.tvMyClanIcon.text = myClan?.icon ?: "⚔️"
                } else {
                    binding.cardMyClan.visibility = View.GONE
                }

                val all = UpstashRepository.listClans()
                clanList.clear()
                clanList.addAll(all)
                adapter.notifyDataSetChanged()

                if (clanList.isEmpty()) {
                    binding.tvEmptyClans.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                Toast.makeText(this@ClanActivity, "Gagal memuat clan", Toast.LENGTH_SHORT).show()
            } finally {
                binding.pbClanLoading.visibility = View.GONE
            }
        }
    }

    private fun joinClan(clan: ClanItem) {
        val user = authManager.getUserProfile()
        if (user == null) {
            Toast.makeText(this, "Silakan login terlebih dahulu", Toast.LENGTH_SHORT).show()
            return
        }

        if (myClan != null) {
            Toast.makeText(this, "Kamu sudah bergabung di clan lain!", Toast.LENGTH_SHORT).show()
            return
        }

        lifecycleScope.launch {
            try {
                UpstashRepository.joinClan(user, clan.id)
                Toast.makeText(this@ClanActivity, "Berhasil bergabung ke ${clan.name}!", Toast.LENGTH_SHORT).show()
                loadClanData()
            } catch (e: Exception) {
                Toast.makeText(this@ClanActivity, "Gagal bergabung: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun leaveMyClan() {
        val clan = myClan ?: return
        val uid = authManager.userId ?: return

        AlertDialog.Builder(this)
            .setTitle("Keluar Clan?")
            .setMessage("Apakah kamu yakin ingin keluar dari ${clan.name}?")
            .setPositiveButton("Keluar") { _, _ ->
                lifecycleScope.launch {
                    try {
                        UpstashRepository.leaveClan(uid, clan.id)
                        Toast.makeText(this@ClanActivity, "Berhasil keluar dari clan", Toast.LENGTH_SHORT).show()
                        loadClanData()
                    } catch (e: Exception) {}
                }
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun showCreateClanDialog() {
        val user = authManager.getUserProfile()
        if (user == null) {
            Toast.makeText(this, "Silakan login terlebih dahulu", Toast.LENGTH_SHORT).show()
            return
        }

        if (myClan != null) {
            Toast.makeText(this, "Kamu sudah menjadi anggota clan! Keluar dulu untuk membuat clan baru.", Toast.LENGTH_LONG).show()
            return
        }

        val view = LayoutInflater.from(this).inflate(R.layout.dialog_create_clan, null)
        val etName = view.findViewById<EditText>(R.id.etCreateClanName)
        val etTag = view.findViewById<EditText>(R.id.etCreateClanTag)
        val etDesc = view.findViewById<EditText>(R.id.etCreateClanDesc)
        val btnSubmit = view.findViewById<MaterialButton>(R.id.btnSubmitCreateClan)

        val dialog = AlertDialog.Builder(this)
            .setView(view)
            .create()

        btnSubmit.setOnClickListener {
            val name = etName.text.toString().trim()
            val tag = etTag.text.toString().trim()
            val desc = etDesc.text.toString().trim()

            if (name.isBlank() || tag.isBlank()) {
                Toast.makeText(this, "Nama dan Tag clan wajib diisi", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialog.dismiss()
            lifecycleScope.launch {
                try {
                    UpstashRepository.createClan(user, name, tag, desc, "⚔️", "#D4A73C")
                    Toast.makeText(this@ClanActivity, "Clan $name berhasil dibuat!", Toast.LENGTH_SHORT).show()
                    loadClanData()
                } catch (e: Exception) {
                    Toast.makeText(this@ClanActivity, "Gagal membuat clan: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        dialog.show()
    }
}
