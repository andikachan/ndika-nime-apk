package com.ndikanime.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.ndikanime.app.R
import com.ndikanime.app.databinding.ActivityMainBinding
import com.ndikanime.app.ui.anime.AnimeFragment
import com.ndikanime.app.ui.explore.ExploreFragment
import com.ndikanime.app.ui.library.LibraryFragment
import com.ndikanime.app.ui.manga.MangaFragment

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val animeFragment = AnimeFragment()
    private val mangaFragment = MangaFragment()
    private val exploreFragment = ExploreFragment()
    private val libraryFragment = LibraryFragment()
    private var activeFragment: Fragment = animeFragment

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .add(R.id.fragmentContainer, libraryFragment, "library").hide(libraryFragment)
                .add(R.id.fragmentContainer, exploreFragment, "explore").hide(exploreFragment)
                .add(R.id.fragmentContainer, mangaFragment, "manga").hide(mangaFragment)
                .add(R.id.fragmentContainer, animeFragment, "anime")
                .commit()
            activeFragment = animeFragment
        }

        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.menu_anime -> switchFragment(animeFragment)
                R.id.menu_manga -> switchFragment(mangaFragment)
                R.id.menu_explore -> switchFragment(exploreFragment)
                R.id.menu_library -> switchFragment(libraryFragment)
                else -> false
            }
        }
    }

    private fun switchFragment(target: Fragment): Boolean {
        if (target === activeFragment) return true
        supportFragmentManager.beginTransaction()
            .hide(activeFragment)
            .show(target)
            .commit()
        activeFragment = target
        return true
    }

    fun navigateToExplore(isManga: Boolean = false) {
        binding.bottomNavigation.selectedItemId = R.id.menu_explore
        exploreFragment.setType(isManga)
    }
}
