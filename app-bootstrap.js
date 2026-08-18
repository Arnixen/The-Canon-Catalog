  document.addEventListener('DOMContentLoaded', () => {
    cleanupLegacyCheckedCardStateOnce();

    // Type Select All/Deselect All
    document.getElementById('selectAllTypes').addEventListener('click', () => {
      document.querySelectorAll('#typeCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        cb.closest('.toggle-btn').classList.add('selected');
      });
      applyFilters();
    });
    document.getElementById('deselectAllTypes').addEventListener('click', () => {
      document.querySelectorAll('#typeCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.toggle-btn').classList.remove('selected');
      });
      applyFilters();
    });

    // Universe Select All/Deselect All
    document.getElementById('selectAll').addEventListener('click', () => {
      document.querySelectorAll('#universeCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        cb.closest('.toggle-btn').classList.add('selected');
      });
      applyFilters();
    });
    document.getElementById('deselectAll').addEventListener('click', () => {
      document.querySelectorAll('#universeCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.toggle-btn').classList.remove('selected');
      });
      applyFilters();
    });
    const cardSearch = document.getElementById('cardSearch');
    cardSearch.addEventListener('input', () => {
      applyFilters();
    });
    document.querySelectorAll('#checkedStateSection .checked-state-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setCheckedStateFilterMode(btn.dataset.checkState);
        applyFilters();
      });
    });
    document.getElementById('checkAllCards').addEventListener('click', () => {
      setAllCardsCheckedForCurrentFranchise(true);
    });
    document.getElementById('uncheckAllCards').addEventListener('click', () => {
      setAllCardsCheckedForCurrentFranchise(false);
    });
    document.querySelectorAll('#continuitySection .continuity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedContinuity = btn.dataset.continuity;
        if (!selectedContinuity || selectedContinuity === currentStarWarsContinuity) return;
        currentStarWarsContinuity = selectedContinuity;
        localStorage.setItem(STAR_WARS_CONTINUITY_KEY, currentStarWarsContinuity);
        localStorage.removeItem('typeFilters-StarWars');
        localStorage.removeItem('universeFilters-StarWars');
        localStorage.removeItem('eraFilters-StarWars');
        syncContinuityButtons();
        if (document.getElementById('franchiseSelect').value === 'StarWars') {
          loadFranchise('StarWars');
        }
      });
    });
    const savedFranchiseValue = localStorage.getItem('selectedFranchise');
    const savedFranchise = (savedFranchiseValue && Object.prototype.hasOwnProperty.call(franchiseFiles, savedFranchiseValue)) ? savedFranchiseValue : 'MCU';
    document.getElementById('franchiseSelect').value = savedFranchise;
    renderFranchiseHeadbar();
    syncContinuityButtons();
    updateContinuitySectionVisibility(savedFranchise);
    updateUniverseSectionVisibility(savedFranchise);

    const savedSortMode = localStorage.getItem('sortMode');
    if (savedSortMode === 'timeline' || savedSortMode === 'release') {
      sortMode = savedSortMode;
    }
    updateSortButtonLabel();

    selectFranchise(savedFranchise, { persist: false, force: true });

    const sortButton = document.getElementById('sortButton');
    sortButton.addEventListener('click', () => {
      pendingScrollAnchor = getTimelineScrollAnchor();
      if (sortMode === 'timeline') {
        sortMode = 'release';
      }
      else {
        sortMode = 'timeline';
      }
      // âœ… SAVE IT
      localStorage.setItem('sortMode', sortMode);
      updateSortButtonLabel();

      sortCards(currentData, sortMode);
      renderCards(currentData);
    });

    const compactToggle = document.getElementById('compactToggle');
    let compactMode = localStorage.getItem('compactMode') === 'true';
    function applyCompactMode() {
      if (compactMode) {
        document.documentElement.classList.add('compact-mode');
        compactToggle.textContent = 'Gapped View';
      } else {
        document.documentElement.classList.remove('compact-mode');
        compactToggle.textContent = 'Compact View';
      }
    }
    applyCompactMode();
    compactToggle.addEventListener('click', () => {
      compactMode = !compactMode;
      localStorage.setItem('compactMode', compactMode);
      applyCompactMode();
    });

    const episodicToggle = document.getElementById('episodicToggle');
    if (episodicToggle) {
      function updateEpisodicToggleUI() {
        episodicToggle.innerHTML = `
          <span class="toggle-side ${seriesViewMode === 'episodic' ? 'selected' : ''}">Episodic</span>
          <span class="toggle-separator">/</span>
          <span class="toggle-side ${seriesViewMode === 'series' ? 'selected' : ''}">By Series</span>
        `;
        episodicToggle.setAttribute('aria-label', `View mode: ${seriesViewMode === 'series' ? 'By Series' : 'Episodic'}`);
        episodicToggle.classList.toggle('active', seriesViewMode === 'series');
      }
      updateEpisodicToggleUI();
      episodicToggle.addEventListener('click', () => {
        pendingScrollAnchor = getTimelineScrollAnchor();
        seriesViewMode = seriesViewMode === 'episodic' ? 'series' : 'episodic';
        localStorage.setItem('seriesViewMode', seriesViewMode);
        updateEpisodicToggleUI();
        renderCards(currentData);
      });
    }
  });
