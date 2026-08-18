  function normalizeUniverseLabel(universe, franchiseKey) {
    const trimmed = (universe || '').trim();
    if (!trimmed) return '';

    if (franchiseKey === 'MCU') {
      if (trimmed.includes('Branch') || trimmed === 'Observational Plane' || trimmed === 'Various') {
        return 'What If...? Universes';
      }
    }

    return trimmed;
  }

  function normalizeTypeKey(typeValue) {
    return (typeValue || '').toString().trim().toLowerCase();
  }

  function getStarWarsTypeSortBucket(typeValue) {
    const key = normalizeTypeKey(typeValue);
    if (!key) return 999;

    const isYaNovel = (key.includes('young adult') || /\bya\b/.test(key)) && (key.includes('novel') || key.includes('book'));
    const isKidsType = key.includes('junior') || key.includes('middle-grade') || key.includes('kids') || key.includes('children');

    if (isKidsType) return 100;

    if (key.includes('film') || key === 'movie' || key === 'live action film') return 10;
    if (key.includes('tv (live action)') || key.includes('tv live action') || key.includes('live action tv') || key.includes('live action series')) return 20;
    if ((key.includes('animated') && (key.includes('series') || key.includes('tv'))) && !key.includes('junior') && !key.includes('kids') && !key.includes('children')) return 30;
    if (key.includes('video game') || key === 'game' || key.includes(' game')) return 35;
    if (key.includes('graphic novel') || key.includes('manga')) return 70;
    if (isYaNovel) return 50;
    if (key.includes('comic story')) return 81;
    if (key.includes('novel') || key.includes('book')) return 40;
    if (key.includes('audio')) return 60;
    if (key.includes('comic')) return 80;
    if (key.includes('short story')) return 90;
    if (key.includes('animated short') || key === 'short' || key === 'shorts') return 100;

    return 500;
  }

  function isKidsType(typeValue) {
    const key = normalizeTypeKey(typeValue);
    return key.includes('junior') || key.includes('middle-grade') || key.includes('kids') || key.includes('children');
  }

  function getTypeIconForType(typeValue) {
    const key = normalizeTypeKey(typeValue);
    if (!key) return '';
    const icon = (fileName) => `images/${encodeURIComponent(fileName).replace(/%2F/g, '/')}`;
    const directMap = {
      'film': 'Film.png',
      'movie': 'Film.png',
      'live action film': 'Film.png',
      'tv movie': 'Film.png',
      'tv': 'TV (Live Action).png',
      'series': 'TV (Live Action).png',
      'live action series': 'TV (Live Action).png',
      'tv (live action)': 'TV (Live Action).png',
      'tv episode': 'TV (Live Action).png',
      'tv episode (classicwho)': 'TV (Live Action).png',
      'tv episode (nuwho)': 'TV (Live Action).png',
      'tv episode (spinoff)': 'TV (Live Action).png',
      'special': 'Special.png',
      'tv special (nuwho)': 'Special.png',
      'tv (animated)': 'TV (Animated).png',
      'animated tv': 'TV (Animated).png',
      'animated tv episode': 'TV (Animated).png',
      'tv (junior animated)': 'TV (Animated).png',
      'short': 'Short.png',
      'short (junior)': 'Short.png',
      'audio drama': 'Audio Drama.png',
      'audio drama (junior)': 'Audio Drama (Junior).png',
      'comic (marvel)': 'Comic (Marvel).png',
      'comic story (marvel)': 'Comic (Marvel).png',
      'comic (dark horse)': 'Comic (Dark Horse).png',
      'comic story (dark horse)': 'Comic (Dark Horse).png',
      'comic (idw)': 'Comic (IDW).png',
      'comic story (idw)': 'Comic (IDW).png',
      'comic story (magazine)': 'Comic (Marvel).png',
      'graphic novel': 'Graphic Novel.png',
      'manga': 'Manga.png',
      'book (junior)': 'Book (Junior).png',
      'novel': 'Novel.png',
      'novel (middle-grade)': 'Novel (Middle Grade).png',
      'novel (young adult)': 'Novel (Young Adult).png',
      'short story': 'Short Story.png',
      'short story (insider)': 'Short Story (Insider).png',
      'short story (junior)': 'Short Story (Junior).png',
      'video game': 'Video Game.png',
      'video game (remaster)': 'Video Game.png',
      'video game (spinoff)': 'Video Game.png'
    };

    if (directMap[key]) return icon(directMap[key]);
    if (key.includes('comic')) return icon('Comic (Marvel).png');
    if (key.includes('graphic novel')) return icon('Graphic Novel.png');
    if (key.includes('manga')) return icon('Manga.png');
    if (key.includes('short story')) return icon('Short Story.png');
    if (key.includes('audio')) return icon('Audio Drama.png');
    if (key.includes('junior') && key.includes('book')) return icon('Book (Junior).png');
    if (key.includes('young adult') && key.includes('novel')) return icon('Novel (Young Adult).png');
    if (key.includes('middle-grade') && key.includes('novel')) return icon('Novel (Middle Grade).png');
    if (key.includes('novel')) return icon('Novel.png');
    if (key.includes('game')) return icon('Video Game.png');
    if (key.includes('animated')) return icon('TV (Animated).png');
    if (key.includes('short')) return icon('Short.png');
    if (key.includes('special')) return icon('Special.png');
    if (key.includes('series') || key.includes('tv') || key.includes('episode')) return icon('TV (Live Action).png');
    if (key.includes('film') || key.includes('movie')) return icon('Film.png');

    return '';
  }

  function restoreSearchForFranchise(franchiseKey) {
    const cardSearch = document.getElementById('cardSearch');
    if (!cardSearch) return;
    cardSearch.value = localStorage.getItem(`cardSearch-${franchiseKey}`) || '';
  }

  function restoreEraFilters(franchiseKey) {
    const savedEras = JSON.parse(localStorage.getItem(`eraFilters-${franchiseKey}`) || '[]');
    document.querySelectorAll('#eraFilters .era-btn').forEach(btn => {
      if (savedEras.includes(btn.dataset.era)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  function persistFilterState(franchiseKey) {
    const checkedTypes = Array.from(document.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    const checkedUniverses = Array.from(document.querySelectorAll('#universeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    const selectedEras = Array.from(document.querySelectorAll('#eraFilters .era-btn.selected')).map(btn => btn.dataset.era).filter(Boolean);
    const searchValue = (document.getElementById('cardSearch')?.value || '').trim();
    const checkedStateMode = getCheckedStateFilterMode();

    localStorage.setItem(`typeFilters-${franchiseKey}`, JSON.stringify(checkedTypes));
    localStorage.setItem(`universeFilters-${franchiseKey}`, JSON.stringify(checkedUniverses));
    localStorage.setItem(`eraFilters-${franchiseKey}`, JSON.stringify(selectedEras));
    localStorage.setItem(`cardSearch-${franchiseKey}`, searchValue);
    localStorage.setItem(getCheckedStateFilterKey(franchiseKey), checkedStateMode);
  }

  function applyFilters(anchorOverride = null) {
    const scrollAnchor = anchorOverride || getTimelineScrollAnchor();
    // Get selected types from dynamic checkboxes
    const selectedTypes = Array.from(document.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);

    const selectedUniverses = Array.from(document.querySelectorAll('#universeCheckboxes input:checked')).map(cb => cb.value);
    const selectedEras = Array.from(document.querySelectorAll('#eraFilters .era-btn.selected')).map(btn => btn.dataset.era).filter(Boolean);
    const searchTerm = (document.getElementById('cardSearch')?.value || '').trim().toLowerCase();
    const currentFranchise = document.getElementById('franchiseSelect').value;
    const checkedStateMode = getCheckedStateFilterMode();

    document.querySelectorAll('.card').forEach(card => {
      const cardType = card.dataset.type;
      const cardUniverse = card.dataset.universe;
      const cardEra = card.dataset.era;
      const isCardChecked = card.dataset.checked === 'true';
      const isCardPartiallyChecked = card.dataset.checked === 'partial';
      const cardTitle = (card.dataset.title || '').toLowerCase();
      const cardEpisode = (card.dataset.episode || '').toLowerCase();
      const cardSerialTitle = (card.dataset.serialTitle || '').toLowerCase();
      const cardEpisodeTitle = (card.dataset.eptitle || '').toLowerCase();

      let hidden = false;

      if (selectedTypes.length === 0 || !selectedTypes.includes(cardType)) hidden = true;
      if (currentFranchise !== 'StarWars') {
        if (selectedUniverses.length === 0) hidden = true;
        else {
          // Support multiple universes per entry (comma-separated)
          let universes = cardUniverse ? cardUniverse.split(',').map(u => normalizeUniverseLabel(u.trim(), currentFranchise)) : [];
          // If none of the universes are selected, hide
          if (!universes.some(u => selectedUniverses.includes(u))) hidden = true;
        }
      }
      if (searchTerm && !cardTitle.includes(searchTerm) && !cardEpisode.includes(searchTerm) && !cardSerialTitle.includes(searchTerm) && !cardEpisodeTitle.includes(searchTerm)) {
        hidden = true;
      }
      if (selectedEras.length > 0 && !selectedEras.includes(cardEra)) {
        hidden = true;
      }
      if (checkedStateMode === 'checked' && !(isCardChecked || isCardPartiallyChecked)) {
        hidden = true;
      }
      if (checkedStateMode === 'unchecked' && (isCardChecked || isCardPartiallyChecked)) {
        hidden = true;
      }

      card.style.display = hidden ? 'none' : '';
    });

    // Check if any cards are visible
    const visibleCards = Array.from(document.querySelectorAll('.card')).filter(card => card.style.display !== 'none');
    const noResults = document.getElementById('noResults');
    if (visibleCards.length === 0) {
      noResults.style.display = 'block';
    }
    else {
      noResults.style.display = 'none';
    }
    // Update runtime counter
    updateRuntimeCounter();
    // Instantly update arrow visibility after filtering
    updateArrowVisibility();
    // Persist current filter state so refresh restores the same view
    persistFilterState(currentFranchise);
  }

  console.log('âœ… PARSING SCRIPT LOADED');
