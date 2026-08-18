  function updateArrowVisibility() {
    const leftArrow = document.querySelector('.arrow.left');
    const rightArrow = document.querySelector('.arrow.right');
    if (timeline.scrollWidth > timeline.clientWidth) {
      leftArrow.style.display = '';
      rightArrow.style.display = '';
    } else {
      leftArrow.style.display = 'none';
      rightArrow.style.display = 'none';
    }
  }

  function syncTimelineProgressionBar() {
    const bar = document.querySelector('.timeline-progression');
    if (!bar || !timeline) return;
    bar.style.transform = `translateX(-${timeline.scrollLeft}px)`;
  }

  function renderCards(data) {
    timeline.innerHTML = '';
    const displayData = filterDataBySeriesMode(data, seriesViewMode);
    const seriesRuntimeTotals = seriesViewMode === 'series' ? getSeriesRuntimeTotals(data) : null;
    const seriesEarliestReleaseDates = seriesViewMode === 'series' ? getSeriesEarliestReleaseDates(data) : null;
    const seriesPosterRows = seriesViewMode === 'series' ? getSeriesPosterRows(data) : null;
    const seriesItemCounts = seriesViewMode === 'series' ? getSeriesItemCounts(data) : null;
    const cardFragment = document.createDocumentFragment();
    const activeFranchise = document.getElementById('franchiseSelect').value;
    const checkedCardKeys = getCheckedCardKeys(activeFranchise);
    const posterFolder = 'images';
    function buildPosterSource(posterValue) {
      const source = String(posterValue || '').trim();
      if (!source) return 'images/placeholder-episode.jpg';
      if (/^(?:https?:|data:|blob:)/i.test(source)) return source;
      return `${posterFolder}/${source}`;
    }

    function applyMediaStyles(mediaElement) {
      mediaElement.style.position = 'absolute';
      mediaElement.style.top = '0';
      mediaElement.style.left = '0';
      mediaElement.style.width = '100%';
      mediaElement.style.height = '100%';
      mediaElement.style.zIndex = '0';
    }

    displayData.forEach((row, index) => {
      if (!row.title) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.type = row.type;
      card.dataset.universe = row['universe number'];
      const itemKey = row.__itemKey || `${activeFranchise}-${row.__originalIndex ?? index}`;
      const rowSeriesId = getSeriesIdentifier(row);
      const seriesIdForMeta = seriesViewMode === 'series' ? rowSeriesId : null;
      const checkedState = (seriesViewMode === 'series' && seriesIdForMeta)
        ? getSeriesCheckedState(seriesIdForMeta, checkedCardKeys, currentData)
        : (checkedCardKeys.has(itemKey) ? 'checked' : 'unchecked');
      const isChecked = checkedState === 'checked';
      const isPartiallyChecked = checkedState === 'partial';
      card.dataset.itemKey = itemKey;
      card.dataset.seriesId = rowSeriesId || '';
      card.dataset.checked = isChecked ? 'true' : (isPartiallyChecked ? 'partial' : 'false');
      card.classList.toggle('checked', isChecked);

      const checkControl = document.createElement('label');
      checkControl.className = 'card-check-control';
      checkControl.title = isChecked ? 'Marked checked' : 'Mark as checked';
      checkControl.setAttribute('aria-label', `Mark ${row.title} as checked`);
      const checkInput = document.createElement('input');
      checkInput.type = 'checkbox';
      checkInput.checked = isChecked;
      checkInput.indeterminate = isPartiallyChecked;
      if (isPartiallyChecked) {
        checkInput.setAttribute('aria-checked', 'mixed');
      }
      checkInput.addEventListener('click', (event) => {
        event.stopPropagation();
      });
      checkInput.addEventListener('change', () => {
        const currentlyChecked = checkInput.checked;
        card.dataset.checked = currentlyChecked ? 'true' : 'false';
        card.classList.toggle('checked', currentlyChecked);
        checkControl.title = currentlyChecked ? 'Marked checked' : 'Mark as checked';

        const updatedCheckedKeys = getCheckedCardKeys(activeFranchise);
        if (seriesViewMode === 'series' && seriesIdForMeta) {
          const seriesItemKeys = getItemKeysForSeries(seriesIdForMeta, currentData);
          seriesItemKeys.forEach((seriesItemKey) => {
            if (currentlyChecked) {
              updatedCheckedKeys.add(seriesItemKey);
            } else {
              updatedCheckedKeys.delete(seriesItemKey);
            }
          });
        } else if (currentlyChecked) {
          updatedCheckedKeys.add(itemKey);
        } else {
          updatedCheckedKeys.delete(itemKey);
        }
        saveCheckedCardKeys(activeFranchise, updatedCheckedKeys);
        applyFilters();
      });
      checkControl.appendChild(checkInput);
      checkControl.title = isPartiallyChecked ? 'Partially checked' : (isChecked ? 'Marked checked' : 'Mark as checked');
      card.appendChild(checkControl);

      const posterSourceRow = seriesIdForMeta && seriesPosterRows && seriesPosterRows.has(seriesIdForMeta)
        ? seriesPosterRows.get(seriesIdForMeta)
        : row;
      const isSeriesMode = seriesViewMode === 'series';
      const altPoster = isSeriesMode && typeof posterSourceRow?.['alt-poster'] === 'string' && posterSourceRow['alt-poster'].trim().length > 0
        ? posterSourceRow['alt-poster'].trim()
        : '';
      const hasRemoteAltPoster = /^https?:\/\//i.test(altPoster);
      const poster = isSeriesMode
        ? (hasRemoteAltPoster
          ? altPoster
          : (typeof posterSourceRow?.poster === 'string' && posterSourceRow.poster.trim().length > 0
            ? posterSourceRow.poster.trim()
            : (altPoster || null)))
        : (typeof row?.poster === 'string' && row.poster.trim().length > 0 ? row.poster.trim() : null);
      const isPlaceholder = !poster;

      const createFallbackImage = function() {
        const fallbackImg = document.createElement('img');
        applyMediaStyles(fallbackImg);
        fallbackImg.loading = index < 12 ? 'eager' : 'lazy';
        fallbackImg.decoding = 'async';
        fallbackImg.fetchPriority = index < 12 ? 'high' : 'low';
        fallbackImg.src = buildPosterSource(poster);
        fallbackImg.dataset.fallbackSrc = fallbackImg.src;
        fallbackImg.alt = row.title;
        fallbackImg.onerror = function() {
          if (fallbackImg.src.indexOf('placeholder-episode.jpg') === -1) {
            fallbackImg.src = 'images/placeholder-episode.jpg';
          }
        };
        return fallbackImg;
      };

      const media = createFallbackImage();

      card.dataset.title = row.title || 'Unknown';
      card.dataset.episode = row['episode'] || '';
      card.dataset.serialTitle = row['serial title'] || '';
      card.dataset.eptitle = row['episode title'] || '';
      if (seriesIdForMeta && seriesEarliestReleaseDates && seriesEarliestReleaseDates.has(seriesIdForMeta)) {
        card.dataset.releaseDate = seriesEarliestReleaseDates.get(seriesIdForMeta) || 'Unknown';
      } else {
        card.dataset.releaseDate = row['release date'] || 'Unknown';
      }
      card.dataset.inUniverseTime = row['Galactic Year'] || row['in-universe time'] || '';
      card.dataset.gregorianYear = row['Gregorian Calendar Year'] || row['gregorian calendar year'] || '';
      card.dataset.season = extractSeasonFromEpisode(row['episode'] || '');
      if (seriesIdForMeta && seriesItemCounts && seriesItemCounts.has(seriesIdForMeta)) {
        card.dataset.itemCount = String(seriesItemCounts.get(seriesIdForMeta));
      } else {
        card.dataset.itemCount = '';
      }
      const seriesIdForRuntime = seriesIdForMeta;
      if (seriesIdForRuntime && seriesRuntimeTotals && seriesRuntimeTotals.has(seriesIdForRuntime)) {
        card.dataset.runtime = String(seriesRuntimeTotals.get(seriesIdForRuntime));
      } else {
        card.dataset.runtime = row.runtime || '';
      }
      card.dataset.letterboxd = row['letterboxd url'] || '';
      card.dataset.imdb = row['imdb url'] || '';
      card.dataset.tmdb = getTmdbPageUrlForRow(posterSourceRow || row);
      card.dataset.comicvine = getComicVineUrlForRow(posterSourceRow || row);
      card.dataset.era = row['Era'] || '';

      const normalizedType = (row.type || '').toLowerCase();
      const isComicType = normalizedType === 'comic (dark horse)' || normalizedType === 'comic (marvel)' || normalizedType === 'comic (idw)';
      const isComicStoryType = normalizedType === 'comic story (dark horse)' || normalizedType === 'comic story (marvel)' || normalizedType === 'comic story (joe books)' || normalizedType === 'comic story (idw)';
      const suppressCardEpisode = (normalizedType.includes('novel') || normalizedType.includes('book')) && !isComicStoryType;
      const hasEpisode = !!(row['episode'] && row['episode'].trim());
      const hideCardChromeForSeriesMode = seriesViewMode === 'series';

      const title = document.createElement('span');
      let titleText = '';
      if (isComicStoryType) {
        titleText = row['episode title'] || row.title;
      } else if (hasEpisode && !suppressCardEpisode) {
        const serialTitle = row['serial title'] && row['serial title'] !== row['episode title'] ? row['serial title'] : null;
        if (activeFranchise === 'DoctorWho' && normalizedType === 'classic doctor who' && serialTitle) {
          titleText = `${row['episode']}: ${serialTitle} · ${row['episode title']}`;
        } else {
          titleText = `${row['episode']}: ${row['episode title']}`;
        }
      } else if (!suppressCardEpisode) {
        titleText = row.title;
      }
      title.textContent = titleText;

      if (hideCardChromeForSeriesMode) {
        title.style.display = 'none';
      } else if (isComicType) {
        // Comics render like movies: image-only with no tint or overlaid title text
        title.style.display = 'none';
      } else if (isPlaceholder) {
        // Always show the title in front if using placeholder
        title.style.position = 'absolute';
        title.style.top = '50%';
        title.style.left = '50%';
        title.style.transform = 'translate(-50%, -50%)';
        title.style.zIndex = '2';
        title.style.color = 'white';
        title.style.fontSize = '1.2rem';
        title.style.fontWeight = 'bold';
        title.style.textAlign = 'center';
        title.style.whiteSpace = 'normal';
        title.style.lineHeight = '1.4';
        // Add overlay for readability
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1';
        card.appendChild(overlay);
      } else if (hasEpisode && !suppressCardEpisode) {
        // Show overlay for TV episodes
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1';
        card.appendChild(overlay);

        title.style.position = 'absolute';
        title.style.top = '50%';
        title.style.left = '50%';
        title.style.transform = 'translate(-50%, -50%)';
        title.style.zIndex = '2';
        title.style.color = 'white';
        title.style.fontSize = '1.2rem';
        title.style.fontWeight = 'bold';
        title.style.textAlign = 'center';
        title.style.whiteSpace = 'normal';
        title.style.lineHeight = '1.4';
      } else {
        title.style.display = 'none';
      }

      card.appendChild(media);
      card.appendChild(title);

      // Info overlay
      const infoOverlay = document.createElement('div');
      infoOverlay.className = 'card-info-overlay';
      const isSeriesModeOverlay = seriesViewMode === 'series';
      const nameText = card.dataset.title && card.dataset.title !== 'Unknown' ? `${card.dataset.title}` : '';
      const epText = !isSeriesModeOverlay && card.dataset.episode && card.dataset.episode !== 'Unknown' ? `${card.dataset.episode}` : '';
      const serialTitleText = activeFranchise === 'DoctorWho' && card.dataset.type === 'Classic Doctor Who' && card.dataset.serialTitle && card.dataset.serialTitle !== 'Unknown' && card.dataset.serialTitle !== card.dataset.eptitle
        ? `${card.dataset.serialTitle}`
        : '';
      const epTitleText = !isSeriesModeOverlay && card.dataset.eptitle && card.dataset.eptitle !== 'Unknown' ? `${card.dataset.eptitle}` : '';
      const seasonText = isSeriesModeOverlay && card.dataset.season
        ? `Season ${card.dataset.season.replace(/^S/i, '')}`
        : '';
      const dateText = card.dataset.releaseDate && card.dataset.releaseDate !== 'Unknown' ? `Release Date: ${card.dataset.releaseDate}` : '';
      const galacticYearText = activeFranchise === 'StarWars' && card.dataset.inUniverseTime ? `Galactic Year: ${card.dataset.inUniverseTime}` : '';
      const gregorianYear = activeFranchise === 'StarTrek' ? card.dataset.gregorianYear : '';
      const gregorianYearText = gregorianYear ? `Gregorian Date: ${gregorianYear}` : '';
      const runtimeText = card.dataset.runtime ? `Runtime: ${formatRuntime(card.dataset.runtime)}` : '';
      const countValue = parseInt(card.dataset.itemCount, 10);
      const typeKey = (card.dataset.type || '').toLowerCase();
      const isComicTypeGroup = typeKey.includes('comic');
      const isShortStoryTypeGroup = typeKey.includes('short story');
      const isTvTypeGroup = typeKey.includes('tv') || typeKey.includes('series') || typeKey.includes('episode') || typeKey.includes('special');
      const countLabel = isComicTypeGroup
        ? 'Issues'
        : (isShortStoryTypeGroup ? 'Stories' : (isTvTypeGroup ? 'Episodes' : 'Episodes'));
      const countText = Number.isNaN(countValue) ? '' : `${countLabel}: ${countValue}`;
      let infoHtml = '';
      const topLine = [nameText, seasonText, epText, serialTitleText, epTitleText].filter(Boolean).join(' · ');
      const typeIconSrc = getTypeIconForType(card.dataset.type || '');
      if (topLine) infoHtml += `<div class="overlay-title">${topLine}</div>`;
      if (typeIconSrc) infoHtml += `<img class="overlay-type-icon" src="${typeIconSrc}" alt="${card.dataset.type || ''}" title="${card.dataset.type || ''}">`;
      if (dateText || runtimeText) {
        infoHtml += `<div class="overlay-meta">${[dateText, runtimeText, countText].filter(Boolean).join(' · ')}</div>`;
      }
      if (galacticYearText) {
        infoHtml += `<div class="overlay-meta">${galacticYearText}</div>`;
      }
      if (gregorianYearText) {
        infoHtml += `<div class="overlay-meta">${gregorianYearText}</div>`;
      }
      if (card.dataset.letterboxd || card.dataset.imdb || card.dataset.tmdb || card.dataset.comicvine) {
        infoHtml += '<div class="overlay-links">';
        if (card.dataset.letterboxd) infoHtml += `<a href="${card.dataset.letterboxd}" target="_blank" title="Letterboxd"><img src="images/Letterboxd-logo.png" alt="Letterboxd"></a>`;
        if (card.dataset.imdb) infoHtml += `<a href="${card.dataset.imdb}" target="_blank" title="IMDb"><img src="images/IMDB-logo.png" alt="IMDb"></a>`;
        if (card.dataset.tmdb) infoHtml += `<a href="${card.dataset.tmdb}" target="_blank" title="TMDB" aria-label="TMDB"><img src="images/TMDB-logo.png" alt="TMDB" onerror="this.style.display='none';this.parentNode.textContent='TMDB';"></a>`;
        if (card.dataset.comicvine) infoHtml += `<a href="${card.dataset.comicvine}" target="_blank" rel="noopener noreferrer" title="Comic Vine" aria-label="Comic Vine"><img src="images/comicvine-logo.png" alt="Comic Vine"></a>`;
        infoHtml += '</div>';
      }
      infoOverlay.innerHTML = infoHtml;
      card.appendChild(infoOverlay);
      const timelineTrack = renderCardTimelineTrack(card, row, activeFranchise, currentData);
      if (timelineTrack) {
        infoOverlay.appendChild(timelineTrack);
      }
      attachTouchTapHandler(card, () => {
        const shouldOpen = !card.classList.contains('show-info');
        closeAllTouchCardStates(card);
        card.classList.toggle('show-info', shouldOpen);
      });
      // Overlay hover logic (for touch devices and fallback)
      // Overlay animation handled by CSS only

      cardFragment.appendChild(card);
    });

    timeline.appendChild(cardFragment);
    // Apply filters and restore scroll based on either a pending anchor or persisted value.
    const anchorToRestore = pendingScrollAnchor;
    pendingScrollAnchor = null;
    if (anchorToRestore) {
      applyFilters(anchorToRestore);
    } else {
      applyFilters();
      // Restore raw scroll position AFTER filters are applied, so visibility changes don't affect it.
      // Only restore if the view mode hasn't changed (or was never saved).
      const savedViewMode = localStorage.getItem(SCROLL_VIEW_MODE_KEY);
      const viewModeChanged = savedViewMode && savedViewMode !== seriesViewMode;
      if (!viewModeChanged) {
        requestAnimationFrame(() => {
          timeline.scrollLeft = Number(localStorage.getItem(SCROLL_KEY) || 0);
        });
      }
    }

    // Show/hide arrows based on scrollability, after DOM/layout is updated
    requestAnimationFrame(() => {
      updateArrowVisibility();
      syncTimelineProgressionBar();
    });
    // Also update on scroll and window resize
    timeline.removeEventListener('scroll', updateArrowVisibility);
    timeline.addEventListener('scroll', updateArrowVisibility);
    timeline.removeEventListener('scroll', syncTimelineProgressionBar);
    timeline.addEventListener('scroll', syncTimelineProgressionBar);
    window.removeEventListener('resize', updateArrowVisibility);
    window.addEventListener('resize', updateArrowVisibility);
    window.removeEventListener('resize', syncTimelineProgressionBar);
    window.addEventListener('resize', syncTimelineProgressionBar);
  }

