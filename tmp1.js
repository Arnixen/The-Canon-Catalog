
  window.franchiseFiles = {
    MCU: 'MCU.xlsx',
    StarWars: 'STARWARS.xlsx',
    StarTrek: 'STARTREK.xlsx',
    DoctorWho: 'DOCTORWHO.xlsx',
    AndyWeir: 'ANDYWEIR.xlsx',
    MiddleEarth: 'MIDDLEEARTH.xlsx',
    RiordanVerse: 'RIORDANVERSE.xlsx',
    DCU: 'DCU.xlsx',
    BigBangTheory: 'BIGBANGTHEORY.xlsx',
    Zelda: 'ZELDA.xlsx'
  };
  window.franchiseWorksheetNames = {
    StarWars: { Canon: 'CANON', Legends: 'LEGENDS' }
  };
  // Local references for backward compatibility
  const franchiseFiles = window.franchiseFiles;
  const franchiseWorksheetNames = window.franchiseWorksheetNames;
  const STAR_WARS_CONTINUITY_KEY = 'starWarsContinuity';
  let currentStarWarsContinuity = localStorage.getItem(STAR_WARS_CONTINUITY_KEY) === 'Legends' ? 'Legends' : 'Canon';
  const timeline = document.querySelector('.timeline');
  const hoverReleaseDate = document.getElementById('hoverReleaseDate');
  let lastPointerClientX = 0;
  let lastPointerClientY = 0;
  let hasPointerPosition = false;

  function isTouchInteractionMode() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  function isInteractiveCardTarget(target) {
    return !!(target && target.closest('a,button,input,label,select,textarea'));
  }

  function closeAllTouchCardStates(exceptCard = null) {
    document.querySelectorAll('.card').forEach((cardEl) => {
      if (cardEl === exceptCard) return;
      cardEl.classList.remove('show-info');
      if (typeof cardEl.__closeVideoOverlay === 'function') {
        cardEl.__closeVideoOverlay();
      }
    });
  }

  function attachTouchTapHandler(card, onTap) {
    let startX = 0;
    let startY = 0;
    let moved = false;

    card.addEventListener('touchstart', (event) => {
      if (!isTouchInteractionMode()) return;
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      moved = false;
    }, { passive: true });

    card.addEventListener('touchmove', (event) => {
      if (!isTouchInteractionMode()) return;
      if (event.touches.length !== 1) return;
      const dx = Math.abs(event.touches[0].clientX - startX);
      const dy = Math.abs(event.touches[0].clientY - startY);
      if (dx > 12 || dy > 12) {
        moved = true;
      }
    }, { passive: true });

    card.addEventListener('touchend', (event) => {
      if (!isTouchInteractionMode()) return;
      if (moved) return;
      if (isInteractiveCardTarget(event.target)) return;
      event.preventDefault();
      onTap();
    });
  }

  window.addEventListener('mousemove', (event) => {
    lastPointerClientX = event.clientX;
    lastPointerClientY = event.clientY;
    hasPointerPosition = true;
  }, { passive: true });

  document.addEventListener('touchstart', (event) => {
    if (!isTouchInteractionMode()) return;
    if (event.target.closest('.card')) return;
    closeAllTouchCardStates();
  }, { passive: true });

  function syncHoveredVideoOverlays() {
    document.querySelectorAll('.card video[data-hovering="true"]').forEach((videoEl) => {
      if (typeof videoEl.__syncOverlayPosition === 'function') {
        videoEl.__syncOverlayPosition();
      }
    });
  }
  
  // --- SAVE/RESTORE HORIZONTAL SCROLL POSITION (persisted) ---
  const SCROLL_KEY = 'timeline-scroll-left';
  const SCROLL_VIEW_MODE_KEY = 'timeline-scroll-view-mode';
  let wheelSnapRestoreTimer = null;
  let wheelDeltaAccumulator = 0;
  const WHEEL_NOTCH_DELTA = 100;
  let pendingScrollAnchor = null;

  function getTimelineScrollAnchor() {
    const visibleCards = Array.from(timeline.querySelectorAll('.card')).filter((card) => {
      return card.style.display !== 'none' && card.offsetWidth > 0;
    });
    if (visibleCards.length === 0) return null;

    const leftEdge = timeline.scrollLeft + 1;
    const targetCard = visibleCards.find((card) => (card.offsetLeft + card.offsetWidth) > leftEdge) || visibleCards[visibleCards.length - 1];
    const width = targetCard.offsetWidth || 1;
    const ratio = Math.min(1, Math.max(0, (leftEdge - targetCard.offsetLeft) / width));

    return {
      itemKey: targetCard.dataset.itemKey || '',
      seriesId: targetCard.dataset.seriesId || '',
      ratio
    };
  }

  function restoreTimelineScrollFromAnchor(anchor) {
    if (!anchor) return;

    const visibleCards = Array.from(timeline.querySelectorAll('.card')).filter((card) => {
      return card.style.display !== 'none' && card.offsetWidth > 0;
    });
    if (visibleCards.length === 0) return;

    let targetCard = null;
    if (anchor.itemKey) {
      targetCard = visibleCards.find((card) => card.dataset.itemKey === anchor.itemKey) || null;
    }
    if (!targetCard && anchor.seriesId) {
      targetCard = visibleCards.find((card) => card.dataset.seriesId === anchor.seriesId) || null;
    }
    if (!targetCard) return;

    const width = targetCard.offsetWidth || 1;
    const ratio = Number.isFinite(anchor.ratio) ? Math.min(1, Math.max(0, anchor.ratio)) : 0;
    const desiredLeft = targetCard.offsetLeft + (ratio * width);
    const maxScrollLeft = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
    timeline.scrollLeft = Math.min(maxScrollLeft, Math.max(0, desiredLeft));
  }

  function getTimelineCardStep() {
    const cards = Array.from(timeline.querySelectorAll('.card'));
    const firstVisibleCard = cards.find((card) => card.style.display !== 'none' && card.getBoundingClientRect().width > 0);
    const fallbackCard = cards.find((card) => card.getBoundingClientRect().width > 0);
    const measureCard = firstVisibleCard || fallbackCard;
    const cardWidth = measureCard ? measureCard.getBoundingClientRect().width : (timeline.clientWidth / 6);
    const timelineStyles = getComputedStyle(timeline);
    const gap = parseFloat(timelineStyles.columnGap || timelineStyles.gap || '0') || 0;
    return cardWidth + gap;
  }

  // Save scroll position whenever the user scrolls
  timeline.addEventListener('scroll', () => {
    localStorage.setItem(SCROLL_KEY, timeline.scrollLeft);
    localStorage.setItem(SCROLL_VIEW_MODE_KEY, seriesViewMode);
    syncHoveredVideoOverlays();
  }, { passive: true });

  // Convert vertical wheel input into horizontal timeline scrolling.
  timeline.addEventListener('wheel', (event) => {
    const hasHorizontalOverflow = timeline.scrollWidth > timeline.clientWidth;
    if (!hasHorizontalOverflow) return;
    let primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (primaryDelta === 0) return;

    // Normalize wheel delta modes to pixel-like units.
    if (event.deltaMode === 1) {
      primaryDelta *= 16;
    } else if (event.deltaMode === 2) {
      primaryDelta *= timeline.clientHeight;
    }

    const activeFranchise = document.getElementById('franchiseSelect')?.value || '';
    if (true) {
      timeline.style.scrollSnapType = 'none';
      if (wheelSnapRestoreTimer) {
        clearTimeout(wheelSnapRestoreTimer);
      }
      wheelSnapRestoreTimer = setTimeout(() => {
        wheelSnapRestoreTimer = null;
        const currentFranchise = document.getElementById('franchiseSelect')?.value || '';
        timeline.style.scrollSnapType = 'x mandatory';
      }, 140);
    }

    event.preventDefault();
    wheelDeltaAccumulator += primaryDelta;
    const stepCount = wheelDeltaAccumulator > 0
      ? Math.floor(wheelDeltaAccumulator / WHEEL_NOTCH_DELTA)
      : -Math.floor(Math.abs(wheelDeltaAccumulator) / WHEEL_NOTCH_DELTA);
    if (stepCount === 0) {
      return;
    }

    wheelDeltaAccumulator -= stepCount * WHEEL_NOTCH_DELTA;
    timeline.scrollLeft += stepCount * getTimelineCardStep();
    syncHoveredVideoOverlays();
  }, { passive: false });

  window.addEventListener('scroll', syncHoveredVideoOverlays, { passive: true });
  window.addEventListener('resize', syncHoveredVideoOverlays);
  // --- END SAVE/RESTORE ---

  let currentData = [];
  let sortMode = 'timeline'; // 'timeline' or 'release'
  let seriesViewMode = localStorage.getItem('seriesViewMode') || 'episodic'; // 'episodic' or 'series'
  let cardVideoObserver = null;

  function ensureCardVideoObserver() {
    if (cardVideoObserver || !('IntersectionObserver' in window)) return;
    cardVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const isHovering = video.dataset.hovering === 'true';
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35 && video.closest('.card')?.style.display !== 'none';
        video.dataset.inView = isVisible ? 'true' : 'false';

        if (!isVisible && !isHovering) {
          video.muted = true;
          video.pause();
        }
      });
    }, {
      root: timeline,
      threshold: [0, 0.35, 0.75]
    });
  }

  function observeCardVideo(video) {
    if (!('IntersectionObserver' in window)) return;
    ensureCardVideoObserver();
    video.dataset.inView = 'false';
    cardVideoObserver.observe(video);
  }

  function updateSortButtonLabel() {
    const sortButton = document.getElementById('sortButton');
    if (!sortButton) return;
    sortButton.innerHTML = `
      <span class="toggle-side ${sortMode === 'timeline' ? 'selected' : ''}">Timeline</span>
      <span class="toggle-separator">/</span>
      <span class="toggle-side ${sortMode === 'release' ? 'selected' : ''}">Release</span>
    `;
    sortButton.setAttribute('aria-label', `Sort mode: ${sortMode === 'timeline' ? 'Timeline' : 'Release'}`);
    sortButton.classList.toggle('active', sortMode === 'release');
  }

  function getSortValue(row, fieldName) {
    const value = parseInt(row[fieldName], 10);
    return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
  }

  function compareByOriginalOrder(a, b) {
    return (a.__originalIndex ?? Number.POSITIVE_INFINITY) - (b.__originalIndex ?? Number.POSITIVE_INFINITY);
  }

  function sortCards(data, mode) {
    const fieldName = mode === 'release' ? 'release order number' : 'timeline number';
    data.sort((a, b) => {
      const sortDiff = getSortValue(a, fieldName) - getSortValue(b, fieldName);
      if (sortDiff !== 0) return sortDiff;
      return compareByOriginalOrder(a, b);
    });
  }

  function getStorageFranchiseKey(franchiseKey) {
    if (franchiseKey === 'StarWars') {
      return `StarWars-${currentStarWarsContinuity}`;
    }
    return franchiseKey;
  }

  function getCheckedCardsStorageKey(franchiseKey) {
    return `checkedCards-${getStorageFranchiseKey(franchiseKey)}`;
  }

  function getCheckedStateFilterKey(franchiseKey) {
    return `checkedStateFilter-${getStorageFranchiseKey(franchiseKey)}`;
  }

  function getCheckedCardKeys(franchiseKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(getCheckedCardsStorageKey(franchiseKey)) || '[]');
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  }

  function saveCheckedCardKeys(franchiseKey, checkedKeys) {
    localStorage.setItem(getCheckedCardsStorageKey(franchiseKey), JSON.stringify(Array.from(checkedKeys)));
  }

  function getItemKeysForSeries(seriesId, dataRows) {
    if (!seriesId || !Array.isArray(dataRows)) return [];
    return dataRows
      .filter((row) => getSeriesIdentifier(row) === seriesId)
      .map((row) => row.__itemKey)
      .filter(Boolean);
  }

  function getSeriesCheckedState(seriesId, checkedKeys, dataRows) {
    const keys = getItemKeysForSeries(seriesId, dataRows);
    if (keys.length === 0) return 'unchecked';

    const checkedCount = keys.reduce((count, key) => count + (checkedKeys.has(key) ? 1 : 0), 0);
    if (checkedCount === 0) return 'unchecked';
    if (checkedCount === keys.length) return 'checked';
    return 'partial';
  }

  function setAllCardsCheckedForCurrentFranchise(checked) {
    const currentFranchise = document.getElementById('franchiseSelect')?.value;
    if (!currentFranchise) return;

    const cards = Array.from(document.querySelectorAll('.timeline .card')).filter(card => card.style.display !== 'none');
    const updatedCheckedKeys = getCheckedCardKeys(currentFranchise);

    cards.forEach(card => {
      const itemKey = card.dataset.itemKey;
      if (!itemKey) return;

      card.dataset.checked = checked ? 'true' : 'false';
      card.classList.toggle('checked', checked);

      const checkbox = card.querySelector('.card-check-control input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = checked;
        const control = checkbox.closest('.card-check-control');
        if (control) {
          control.title = checked ? 'Marked checked' : 'Mark as checked';
        }
      }

      const seriesId = card.dataset.seriesId;
      if (seriesViewMode === 'series' && seriesId) {
        const seriesItemKeys = getItemKeysForSeries(seriesId, currentData);
        seriesItemKeys.forEach((seriesItemKey) => {
          if (checked) {
            updatedCheckedKeys.add(seriesItemKey);
          } else {
            updatedCheckedKeys.delete(seriesItemKey);
          }
        });
      } else if (checked) {
        updatedCheckedKeys.add(itemKey);
      } else {
        updatedCheckedKeys.delete(itemKey);
      }
    });

    saveCheckedCardKeys(currentFranchise, updatedCheckedKeys);
    applyFilters();
  }

  function setCheckedStateFilterMode(mode) {
    const targetMode = ['all', 'checked', 'unchecked'].includes(mode) ? mode : 'all';
    document.querySelectorAll('#checkedStateSection .checked-state-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.checkState === targetMode);
    });
  }

  function getCheckedStateFilterMode() {
    const selectedBtn = document.querySelector('#checkedStateSection .checked-state-btn.selected');
    return selectedBtn?.dataset.checkState || 'all';
  }

  function restoreCheckedStateFilter(franchiseKey) {
    const savedMode = localStorage.getItem(getCheckedStateFilterKey(franchiseKey)) || 'all';
    setCheckedStateFilterMode(savedMode);
  }

  function cleanupLegacyCheckedCardStateOnce() {
    const migrationKey = 'checkedCardsMigrationV2';
    if (localStorage.getItem(migrationKey) === 'done') return;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey || !storageKey.startsWith('checkedCards-')) continue;

      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const hasLegacyValues = Array.isArray(parsed) && parsed.some(item => typeof item === 'string' && item.includes('|'));
        if (hasLegacyValues) {
          keysToRemove.push(storageKey);
        }
      } catch {
        keysToRemove.push(storageKey);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(migrationKey, 'done');
  }

  function updateContinuitySectionVisibility(franchiseKey) {
    const continuitySection = document.getElementById('continuitySection');
    if (!continuitySection) return;
    continuitySection.style.display = franchiseKey === 'StarWars' ? 'block' : 'none';
  }

  function updateUniverseSectionVisibility(franchiseKey) {
    const universeSection = document.getElementById('universeSection');
    if (!universeSection) return;
    universeSection.style.display = franchiseKey === 'StarWars' ? 'none' : '';
  }

  function getEraLogoCandidates(era) {
    const normalized = era.toLowerCase().replace(/\s+/g, '-');
    const candidates = [`${normalized}-logo.png`];
    if (normalized.startsWith('the-')) {
      candidates.push(`${normalized.slice(4)}-logo.png`);
    }
    return candidates;
  }

  function syncContinuityButtons() {
    document.querySelectorAll('#continuitySection .continuity-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.continuity === currentStarWarsContinuity);
    });
  }

  function formatRuntime(runtimeMinutes) {
    const minutes = parseInt(runtimeMinutes, 10);
    if (Number.isNaN(minutes)) return '';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
  }

  function formatTotalRuntime(totalMinutes) {
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    let str = '';
    if (days > 0) str += `${days}d `;
    if (hours > 0 || days > 0) str += `${hours}h `;
    str += `${minutes}m`;
    return str.trim();
  }

  function updateRuntimeCounter() {
    const visibleCards = Array.from(document.querySelectorAll('.card')).filter(card => card.style.display !== 'none');
    let totalMinutes = 0;
    visibleCards.forEach(card => {
      const runtime = parseInt(card.dataset.runtime, 10);
      if (!isNaN(runtime)) totalMinutes += runtime;
    });
    const runtimeCounterValue = document.getElementById('runtimeCounterValue');
    if (runtimeCounterValue) {
      runtimeCounterValue.textContent = formatTotalRuntime(totalMinutes);
    }
  }

  function getTimelineStartEndValues(row, franchiseKey) {
    const normalizeCandidate = (value) => {
      if (value === null || value === undefined) return '';
      const trimmed = String(value).trim();
      if (!trimmed) return '';
      const lowered = trimmed.toLowerCase();
      if (lowered === 'unknown' || lowered === 'none' || lowered === 'n/a' || lowered === 'null') return '';
      return trimmed;
    };

    const findRowValue = (variants) => {
      const keys = Object.keys(row || {});
      for (const key of keys) {
        const lowered = String(key).toLowerCase();
        const normalizedKey = lowered.replace(/[^a-z0-9]+/g, '');
        const matched = variants.some((variant) => {
          const normalizedVariant = String(variant).toLowerCase().replace(/[^a-z0-9]+/g, '');
          return normalizedKey === normalizedVariant;
        });
        if (matched) {
          return row[key];
        }
      }
      return '';
    };

    const formatDateValue = (value) => {
      if (value === null || value === undefined) return '';
      if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        const serial = Number(value);
        const epoch = Date.UTC(1899, 11, 30);
        const utcDate = new Date(epoch + (serial * 86400000));
        return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
      }
      const normalized = normalizeCandidate(value);
      if (!normalized) return '';
      return normalized;
    };

    const startValue = formatDateValue(findRowValue(['setting - starts', 'setting starts', 'settingstarts', 'start date', 'startdate', 'start_date', 'start', 'starts']));
    const endValue = formatDateValue(findRowValue(['setting - ends', 'setting ends', 'settingends', 'end date', 'enddate', 'end_date', 'end', 'ends']));

    return { startValue, endValue };
  }

  function getInUniverseTimeLabel(row, franchiseKey) {
    const { startValue, endValue } = getTimelineStartEndValues(row, franchiseKey);

    const normalizeCandidate = (value) => {
      if (value === null || value === undefined) return '';
      const trimmed = String(value).trim();
      if (!trimmed) return '';
      const lowered = trimmed.toLowerCase();
      if (lowered === 'unknown' || lowered === 'none' || lowered === 'n/a' || lowered === 'null') return '';
      return trimmed;
    };

    const formatTimelineValueForDisplay = (value) => {
      const normalized = normalizeCandidate(value);
      if (!normalized) return '';

      const parsed = parseTimelineValue(normalized);
      if (parsed) {
        return formatTimelineMarkerLabel(normalized, parsed);
      }
      return normalized;
    };

    const formattedStartValue = formatTimelineValueForDisplay(startValue);
    const formattedEndValue = formatTimelineValueForDisplay(endValue);

    if (formattedStartValue && formattedEndValue) {
      const sameDate = formattedStartValue === formattedEndValue;
      return sameDate ? formattedStartValue : `${formattedStartValue} - ${formattedEndValue}`;
    }

    if (formattedStartValue) {
      const rangeMatch = String(formattedStartValue).match(/^(.*?)(?:\s*(?:to|-|–|—)\s*)(.*)$/i);
      if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        return `${rangeMatch[1].trim()} - ${rangeMatch[2].trim()}`;
      }
      return formattedStartValue;
    }

    if (startValue) {
      const rangeMatch = String(startValue).match(/^(.*?)(?:\s*(?:to|-|–|—)\s*)(.*)$/i);
      if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        return `${rangeMatch[1].trim()} - ${rangeMatch[2].trim()}`;
      }
      return startValue;
    }

    if (endValue) {
      return endValue;
    }

    if (franchiseKey === 'StarWars') {
      const candidates = [row['Galactic Year'], row['in-universe time'], row['in universe time']];
      for (const candidate of candidates) {
        const formatted = formatTimelineValueForDisplay(candidate);
        if (formatted) return formatted;
      }
    } else if (franchiseKey === 'StarTrek') {
      const candidates = [row['Gregorian Calendar Year'], row['gregorian calendar year'], row['Stardate'], row['stardate']];
      for (const candidate of candidates) {
        const formatted = formatTimelineValueForDisplay(candidate);
        if (formatted) return formatted;
      }
    } else if (franchiseKey === 'MCU' || franchiseKey === 'DCU') {
      const candidates = [row['Setting'], row['setting']];
      for (const candidate of candidates) {
        const formatted = formatTimelineValueForDisplay(candidate);
        if (formatted) return formatted;
      }
    } else {
      const candidates = [row['Setting'], row['setting']];
      for (const candidate of candidates) {
        const formatted = formatTimelineValueForDisplay(candidate);
        if (formatted) return formatted;
      }
    }

    return '';
  }

  function getSeriesTimelineRangeValues(dataRows, franchiseKey, seriesId) {
    if (!seriesId || !Array.isArray(dataRows)) return null;

    const matchingRows = dataRows.filter((row) => getSeriesIdentifier(row) === seriesId);
    if (!matchingRows.length) return null;

    const firstRow = matchingRows[0];
    const lastRow = matchingRows[matchingRows.length - 1];
    const firstValues = getTimelineStartEndValues(firstRow, franchiseKey);
    const lastValues = getTimelineStartEndValues(lastRow, franchiseKey);

    const startValue = firstValues.startValue || lastValues.startValue || '';
    const endValue = lastValues.endValue || firstValues.endValue || '';

    if (!startValue && !endValue) return null;
    if (startValue && endValue) {
      return { startValue, endValue };
    }
    if (startValue) {
      return { startValue, endValue: '' };
    }
    return { startValue: '', endValue };
  }

  function parseTimelineValue(label) {
    const raw = String(label || '').trim();
    if (!raw) return null;

    const normalized = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    const monthNameToNumber = (name) => {
      const match = String(name || '').trim().toLowerCase();
      if (!match) return null;
      const shortMatch = match.slice(0, 3);
      const index = monthNames.indexOf(shortMatch);
      return index >= 0 ? index + 1 : null;
    };

    const parseDateLike = (value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return null;

      const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (isoMatch) {
        return {
          year: Number(isoMatch[1]),
          month: Number(isoMatch[2]),
          day: Number(isoMatch[3])
        };
      }

      const monthDayYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
      if (monthDayYearMatch) {
        const month = monthNameToNumber(monthDayYearMatch[1]);
        if (month) {
          return {
            year: Number(monthDayYearMatch[3] || 0),
            month,
            day: Number(monthDayYearMatch[2])
          };
        }
      }

      const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s*,?\s*(\d{4})$/);
      if (monthYearMatch) {
        const month = monthNameToNumber(monthYearMatch[1]);
        if (month) {
          return {
            year: Number(monthYearMatch[2]),
            month
          };
        }
      }

      const dayMonthYearMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?$/);
      if (dayMonthYearMatch) {
        const month = monthNameToNumber(dayMonthYearMatch[2]);
        if (month) {
          return {
            year: Number(dayMonthYearMatch[3] || 0),
            month,
            day: Number(dayMonthYearMatch[1])
          };
        }
      }

      return null;
    };

    const singleDate = parseDateLike(normalized);
    if (singleDate) {
      return singleDate;
    }

    const isoRangeMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*(?:to|-|–|—)\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/i);
    if (isoRangeMatch) {
      return {
        isRange: true,
        start: { year: Number(isoRangeMatch[1]), month: Number(isoRangeMatch[2]), day: Number(isoRangeMatch[3]) },
        end: { year: Number(isoRangeMatch[4]), month: Number(isoRangeMatch[5]), day: Number(isoRangeMatch[6]) }
      };
    }

    const rangeMatch = normalized.match(/^(.*?)(?:\s*(?:to|-|–|—)\s*)(.*)$/i);
    if (rangeMatch) {
      const start = parseDateLike(rangeMatch[1]);
      const end = parseDateLike(rangeMatch[2]);
      if (start && end) {
        return { isRange: true, start, end };
      }
    }

    const isoMatch = normalized.match(/(\d{4})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      return { year, month };
    }

    const simpleNumberMatch = normalized.match(/^(\d{4}|\d{3})(?:\s*(BC|BCE|AD|CE|BBY|ABY))?$/i);
    if (simpleNumberMatch) {
      const year = Number(simpleNumberMatch[1]);
      if (year >= 100 && year <= 9999) {
        return {
          year,
          era: simpleNumberMatch[2] ? simpleNumberMatch[2].toUpperCase() : null
        };
      }
    }

    const yearMatches = normalized.match(/\b(\d{3,4})\b/);
    if (!yearMatches) return null;

    const year = Number(yearMatches[1]);
    if (year < 100 || year > 9999) return null;

    let month = null;
    const monthNameMatch = normalized.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (monthNameMatch) {
      month = monthNameToNumber(monthNameMatch[1]);
    }

    return { year, month };
  }

  function formatTimelineMarkerLabel(label, parsed) {
    if (!parsed) return label;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formatDate = (date) => {
      if (!date) return '';
      const eraSuffix = date.era ? ` ${date.era.toUpperCase()}` : '';
      if (date.day && date.month) {
        return `${monthNames[date.month - 1] || date.month} ${date.day}, ${date.year}${eraSuffix}`;
      }
      if (date.month) {
        return `${monthNames[date.month - 1] || date.month} ${date.year}${eraSuffix}`;
      }
      return `${date.year}${eraSuffix}`;
    };

    const formatRange = (start, end) => {
      if (!start || !end) return '';

      const sameYear = start.year === end.year;
      const sameMonth = sameYear && start.month && end.month && start.month === end.month;

      if (start.day && !end.day && end.month) {
        return `${formatDate(start)} - ${formatDate(end)}`;
      }

      if (sameYear && sameMonth && start.day && end.day) {
        return `${monthNames[start.month - 1] || start.month} ${start.day} - ${end.day}, ${start.year}`;
      }

      if (sameYear && start.month && end.month) {
        return `${monthNames[start.month - 1] || start.month} ${start.day || ''} - ${monthNames[end.month - 1] || end.month} ${end.day || ''}, ${start.year}`;
      }

      if (sameYear) {
        return `${formatDate(start)} - ${formatDate(end)}`;
      }

      return `${formatDate(start)} - ${formatDate(end)}`;
    };

    if (parsed.isRange && parsed.start && parsed.end) {
      return formatRange(parsed.start, parsed.end);
    }

    if (parsed.day && parsed.month) {
      return formatDate(parsed);
    }
    if (parsed.month) {
      return `${monthNames[parsed.month - 1] || parsed.month} ${parsed.year}`;
    }
    if (parsed.era) {
      return `${parsed.year} ${parsed.era.toUpperCase()}`;
    }
    if (/\b(?:BC|BCE|AD|CE|BBY|ABY)\b/i.test(label)) {
      return label;
    }
    return String(parsed.year);
  }

  function renderCardTimelineTrack(card, row, franchiseKey, dataRows) {
      if (value === null || value === undefined) return '';
      const trimmed = String(value).trim();
      if (!trimmed) return '';
      const lowered = trimmed.toLowerCase();
      if (lowered === 'unknown' || lowered === 'none' || lowered === 'n/a' || lowered === 'null') return '';
      return trimmed;
    };

    const formatReadableTimelineValue = (value) => {
      const normalized = normalizeCandidate(value);
      if (!normalized) return '';

      const numericMatch = normalized.match(/^\d+(?:\.\d+)?$/);
      if (numericMatch) {
        const number = Number(normalized);
        if (Number.isFinite(number) && number > 1000) {
          return String(Math.round(number));
        }
      }

      const serialMatch = normalized.match(/^\d+(?:\.\d+)?$/);
      if (serialMatch) {
        const serial = Number(normalized);
        if (Number.isFinite(serial) && serial > 1) {
          const epoch = Date.UTC(1899, 11, 31);
          const days = serial > 59 ? serial - 1 : serial;
          const utcDate = new Date(epoch + (days * 86400000));
          const year = utcDate.getUTCFullYear();
          const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(utcDate.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }

      return normalized;
    };

    const candidates = [];
    if (franchiseKey === 'StarWars') {
      candidates.push(row['Galactic Year'], row['in-universe time'], row['in universe time']);
    } else if (franchiseKey === 'StarTrek') {
      candidates.push(row['Gregorian Calendar Year'], row['gregorian calendar year'], row['Stardate'], row['stardate']);
    } else if (franchiseKey === 'MCU' || franchiseKey === 'DCU') {
      candidates.push(row['Setting'], row['setting']);
    } else {
      candidates.push(row['Setting'], row['setting']);
    }

    for (const candidate of candidates) {
      const formatted = formatReadableTimelineValue(candidate);
      if (formatted) return formatted;
    }
    return '';
  }

  function getSeriesTimelineRangeValues(dataRows, franchiseKey, seriesId) {
    if (!seriesId || !Array.isArray(dataRows)) return null;

    const matchingRows = dataRows.filter((row) => getSeriesIdentifier(row) === seriesId);
    if (!matchingRows.length) return null;

    const firstRow = matchingRows[0];
    const lastRow = matchingRows[matchingRows.length - 1];
    const firstValues = getTimelineStartEndValues(firstRow, franchiseKey);
    const lastValues = getTimelineStartEndValues(lastRow, franchiseKey);

    const startValue = firstValues.startValue || lastValues.startValue || '';
    const endValue = lastValues.endValue || firstValues.endValue || '';

    if (!startValue && !endValue) return null;
    if (startValue && endValue) {
      return { startValue, endValue };
    }
    if (startValue) {
      return { startValue, endValue: '' };
    }
    return { startValue: '', endValue };
  }

  function parseTimelineValue(label) {
    const raw = String(label || '').trim();
    if (!raw) return null;

    const normalized = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    const monthNameToNumber = (name) => {
      const match = String(name || '').trim().toLowerCase();
      if (!match) return null;
      const shortMatch = match.slice(0, 3);
      const index = monthNames.indexOf(shortMatch);
      return index >= 0 ? index + 1 : null;
    };

    const parseDateLike = (value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return null;

      const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (isoMatch) {
        return {
          year: Number(isoMatch[1]),
          month: Number(isoMatch[2]),
          day: Number(isoMatch[3])
        };
      }

      const monthDayYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
      if (monthDayYearMatch) {
        const month = monthNameToNumber(monthDayYearMatch[1]);
        if (month) {
          return {
            year: Number(monthDayYearMatch[3] || 0),
            month,
            day: Number(monthDayYearMatch[2])
          };
        }
      }

      const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s*,?\s*(\d{4})$/);
      if (monthYearMatch) {
        const month = monthNameToNumber(monthYearMatch[1]);
        if (month) {
          return {
            year: Number(monthYearMatch[2]),
            month
          };
        }
      }

      const dayMonthYearMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?$/);
      if (dayMonthYearMatch) {
        const month = monthNameToNumber(dayMonthYearMatch[2]);
        if (month) {
          return {
            year: Number(dayMonthYearMatch[3] || 0),
            month,
            day: Number(dayMonthYearMatch[1])
          };
        }
      }

      return null;
    };

    const singleDate = parseDateLike(normalized);
    if (singleDate) {
      return singleDate;
    }

    const isoRangeMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*(?:to|-|–|—)\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/i);
    if (isoRangeMatch) {
      return {
        isRange: true,
        start: { year: Number(isoRangeMatch[1]), month: Number(isoRangeMatch[2]), day: Number(isoRangeMatch[3]) },
        end: { year: Number(isoRangeMatch[4]), month: Number(isoRangeMatch[5]), day: Number(isoRangeMatch[6]) }
      };
    }

    const rangeMatch = normalized.match(/^(.*?)(?:\s*(?:to|-|–|—)\s*)(.*)$/i);
    if (rangeMatch) {
      const start = parseDateLike(rangeMatch[1]);
      const end = parseDateLike(rangeMatch[2]);
      if (start && end) {
        return { isRange: true, start, end };
      }
    }

    const isoMatch = normalized.match(/(\d{4})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      return { year, month };
    }

    const simpleNumberMatch = normalized.match(/^(\d{4}|\d{3})(?:\s*(BC|BCE|AD|CE|BBY|ABY))?$/i);
    if (simpleNumberMatch) {
      const year = Number(simpleNumberMatch[1]);
      if (year >= 100 && year <= 9999) {
        return {
          year,
          era: simpleNumberMatch[2] ? simpleNumberMatch[2].toUpperCase() : null
        };
      }
    }

    const yearMatches = normalized.match(/\b(\d{3,4})\b/);
    if (!yearMatches) return null;

    const year = Number(yearMatches[1]);
    if (year < 100 || year > 9999) return null;

    let month = null;
    const monthNameMatch = normalized.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (monthNameMatch) {
      month = monthNameToNumber(monthNameMatch[1]);
    }

    return { year, month };
  }

  function formatTimelineMarkerLabel(label, parsed) {
    if (!parsed) return label;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formatDate = (date) => {
      if (!date) return '';
      const eraSuffix = date.era ? ` ${date.era.toUpperCase()}` : '';
      if (date.day && date.month) {
        return `${monthNames[date.month - 1] || date.month} ${date.day}, ${date.year}${eraSuffix}`;
      }
      if (date.month) {
        return `${monthNames[date.month - 1] || date.month} ${date.year}${eraSuffix}`;
      }
      return `${date.year}${eraSuffix}`;
    };

    const formatRange = (start, end) => {
      if (!start || !end) return '';

      const sameYear = start.year === end.year;
      const sameMonth = sameYear && start.month && end.month && start.month === end.month;

      if (start.day && !end.day && end.month) {
        return `${formatDate(start)} - ${formatDate(end)}`;
      }

      if (sameYear && sameMonth && start.day && end.day) {
        return `${monthNames[start.month - 1] || start.month} ${start.day} - ${end.day}, ${start.year}`;
      }

      if (sameYear && start.month && end.month) {
        return `${monthNames[start.month - 1] || start.month} ${start.day || ''} - ${monthNames[end.month - 1] || end.month} ${end.day || ''}, ${start.year}`;
      }

      if (sameYear) {
        return `${formatDate(start)} - ${formatDate(end)}`;
      }

      return `${formatDate(start)} - ${formatDate(end)}`;
    };

    if (parsed.isRange && parsed.start && parsed.end) {
      return formatRange(parsed.start, parsed.end);
    }

    if (parsed.day && parsed.month) {
      return formatDate(parsed);
    }
    if (parsed.month) {
      return `${monthNames[parsed.month - 1] || parsed.month} ${parsed.year}`;
    }
    if (parsed.era) {
      return `${parsed.year} ${parsed.era.toUpperCase()}`;
    }
    if (/\b(?:BC|BCE|AD|CE|BBY|ABY)\b/i.test(label)) {
      return label;
    }
    return String(parsed.year);
  }

  function renderCardTimelineTrack(card, row, franchiseKey, dataRows) {
    if (sortMode !== 'timeline') return null;

    let label = getInUniverseTimeLabel(row, franchiseKey);
    const seriesId = getSeriesIdentifier(row);
    if (seriesViewMode === 'series' && seriesId && Array.isArray(dataRows)) {
      const seriesRange = getSeriesTimelineRangeValues(dataRows, franchiseKey, seriesId);
      if (seriesRange) {
        const combinedLabel = [seriesRange.startValue, seriesRange.endValue].filter(Boolean).join(' - ');
        if (combinedLabel) {
          label = combinedLabel;
        }
      }
    }

    if (!label) return null;

    const parsed = parseTimelineValue(label);

    const labelEl = document.createElement('div');
    labelEl.className = 'card-time-track-label';
    labelEl.textContent = `Takes Place: ${formatTimelineMarkerLabel(label, parsed)}`;
    return labelEl;
  }

  function saveFilters() {
    const filters = {
        movie: document.getElementById('movie').checked,
        episode: document.getElementById('episode').checked,
        oneShot: document.getElementById('oneShot').checked,
        short: document.getElementById('short').checked,
        universes: Array.from(
        document.querySelectorAll('#universeCheckboxes input:checked')
        ).map(cb => cb.value)
    };

    localStorage.setItem(`filters-${franchiseKey}`, JSON.stringify(filters));
  }

  // Arrow visibility update function (hoisted for use in applyFilters)
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
    if (cardVideoObserver) {
      cardVideoObserver.disconnect();
    }
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
      const poster = isSeriesMode
        ? (altPoster || (typeof posterSourceRow?.poster === 'string' && posterSourceRow.poster.trim().length > 0 ? posterSourceRow.poster.trim() : null))
        : (typeof row?.poster === 'string' && row.poster.trim().length > 0 ? row.poster.trim() : null);
      const isVideoPoster = !!poster && /\.mp4$/i.test(poster);
      const isPlaceholder = !poster;

      const createFallbackImage = function() {
        const fallbackImg = document.createElement('img');
        applyMediaStyles(fallbackImg);
        fallbackImg.loading = index < 12 ? 'eager' : 'lazy';
        fallbackImg.decoding = 'async';
        fallbackImg.fetchPriority = index < 12 ? 'high' : 'low';
        fallbackImg.src = poster ? `${posterFolder}/${poster}` : 'images/placeholder-episode.jpg';
        fallbackImg.alt = row.title;
        fallbackImg.onerror = function() {
          if (fallbackImg.src.indexOf('placeholder-episode.jpg') === -1) {
            fallbackImg.src = 'images/placeholder-episode.jpg';
          }
        };
        return fallbackImg;
      };

      let media = null;
      if (isVideoPoster) {
        const video = document.createElement('video');
        applyMediaStyles(video);
        const source = document.createElement('source');
        source.src = `${posterFolder}/${poster}`;
        source.type = 'video/mp4';
        video.loop = true;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-label', row.title);
        video.appendChild(source);
        video.addEventListener('loadeddata', () => {
          if (!('IntersectionObserver' in window)) {
            video.play().catch(() => {});
          }
        }, { once: true });
        let overlayTrackRafId = null;
        let lastResumeAttemptAt = 0;

        const stopOverlayTracking = () => {
          if (overlayTrackRafId !== null) {
            cancelAnimationFrame(overlayTrackRafId);
            overlayTrackRafId = null;
          }
        };

        const applyOverlayPosition = () => {
          const card = video.closest('.card');
          if (!card) return;
          if (video.videoWidth && video.videoHeight) {
            const videoRatio = video.videoWidth / video.videoHeight;
            const cardRect = card.getBoundingClientRect();
            const cardW = card.offsetWidth;
            const cardH = card.offsetHeight;
            const widthAtCardHeight = cardH * videoRatio;
            if (widthAtCardHeight >= cardW) {
              const overlayW = widthAtCardHeight;
              const overlayH = cardH;
              const overlayLeft = cardRect.left + ((cardW - overlayW) / 2);
              video.style.position = 'fixed';
              video.style.top = `${cardRect.top}px`;
              video.style.left = `${overlayLeft}px`;
              video.style.width = `${overlayW}px`;
              video.style.height = `${overlayH}px`;
            } else {
              const overlayW = cardW;
              const overlayH = (cardW / videoRatio);
              video.style.position = 'fixed';
              video.style.top = `${cardRect.top}px`;
              video.style.left = `${cardRect.left}px`;
              video.style.width = `${overlayW}px`;
              video.style.height = `${overlayH}px`;
            }
            video.style.transform = '';
            video.style.zIndex = '2000';
            video.style.pointerEvents = 'none';
            video.style.borderRadius = '10px';
            video.style.boxShadow = '0 8px 32px rgba(0,0,0,0.7)';

            // Keep the card checkbox in front of the fixed-position video overlay.
            checkControl.style.position = 'fixed';
            checkControl.style.top = `${cardRect.top + 8}px`;
            checkControl.style.right = `${Math.max(0, window.innerWidth - cardRect.right + 8)}px`;
            checkControl.style.left = '';
            checkControl.style.zIndex = '3001';
          }
          card.classList.add('video-playing');
        };
        video.__syncOverlayPosition = applyOverlayPosition;

        const closeOverlayImmediately = () => {
          video.dataset.hovering = 'false';
          stopOverlayTracking();
          video.muted = true;
          video.pause();
          video.style.position = 'absolute';
          video.style.top = '0';
          video.style.left = '0';
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.transform = '';
          video.style.zIndex = '0';
          video.style.pointerEvents = '';
          video.style.borderRadius = '';
          video.style.boxShadow = '';
          checkControl.style.position = '';
          checkControl.style.top = '';
          checkControl.style.right = '';
          checkControl.style.left = '';
          checkControl.style.zIndex = '';
          card.classList.remove('video-playing');
        };
        card.__closeVideoOverlay = closeOverlayImmediately;

        const startOverlayTracking = () => {
          stopOverlayTracking();
          const tick = () => {
            if (video.dataset.hovering !== 'true') {
              stopOverlayTracking();
              return;
            }
            if (video.paused && !video.ended) {
              const now = performance.now();
              if (now - lastResumeAttemptAt > 250) {
                lastResumeAttemptAt = now;
                video.play().catch(() => {});
              }
            }
            if (hasPointerPosition) {
              const rect = card.getBoundingClientRect();
              const pointerInside =
                lastPointerClientX >= rect.left &&
                lastPointerClientX <= rect.right &&
                lastPointerClientY >= rect.top &&
                lastPointerClientY <= rect.bottom;
              if (!pointerInside) {
                closeOverlayImmediately();
                return;
              }
            }
            applyOverlayPosition();
            overlayTrackRafId = requestAnimationFrame(tick);
          };
          tick();
        };

        const openOverlayAfterHoverDelay = () => {
          video.dataset.hovering = 'true';
          video.muted = false;
          video.play().catch(() => {
            video.muted = true;
          });
          if (video.readyState >= 1) {
            startOverlayTracking();
          } else {
            video.addEventListener('loadedmetadata', startOverlayTracking, { once: true });
          }
        };

        card.addEventListener('mouseenter', (event) => {
          lastPointerClientX = event.clientX;
          lastPointerClientY = event.clientY;
          hasPointerPosition = true;
          openOverlayAfterHoverDelay();
        });
        card.addEventListener('mouseleave', () => {
          closeOverlayImmediately();
        });
        video.onerror = function() {
          if (card.contains(video)) {
            card.replaceChild(createFallbackImage(), video);
          }
        };
        media = video;
      } else {
        media = createFallbackImage();
      }

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
      if (media.tagName === 'VIDEO') {
        observeCardVideo(media);
      }
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
      if (card.dataset.letterboxd || card.dataset.imdb) {
        infoHtml += '<div class="overlay-links">';
        if (card.dataset.letterboxd) infoHtml += `<a href="${card.dataset.letterboxd}" target="_blank" title="Letterboxd"><img src="images/letterboxd-icon.png" alt="Letterboxd"></a>`;
        if (card.dataset.imdb) infoHtml += `<a href="${card.dataset.imdb}" target="_blank" title="IMDb"><img src="images/imdb-icon.png" alt="IMDb"></a>`;
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

  const leftArrow = document.querySelector('.arrow.left');
  const rightArrow = document.querySelector('.arrow.right');

  function getScrollAmount() {
    const cards = Array.from(timeline.querySelectorAll('.card')).filter(card => card.style.display !== 'none');
    if (cards.length === 0) return 0;

    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(timeline).gap || '0');

    const cardsPerView = parseInt(
        getComputedStyle(document.documentElement)
        .getPropertyValue('--cards-per-view')
    );

    return (cardWidth + gap) * cardsPerView;
  }

  rightArrow.addEventListener('click', () => {
    timeline.scrollBy({
      left: getScrollAmount(),
      behavior: 'smooth'
    });
  });

  leftArrow.addEventListener('click', () => {
    timeline.scrollBy({
      left: -getScrollAmount(),
      behavior: 'smooth'
    });
  });

  const franchiseBrandMap = {
    MCU: {
      label: 'Marvel Studios',
      logo: 'marvel-studios-logo.png'
    },
    StarWars: {
      label: 'Star Wars',
      logo: 'star-wars-logo.png',
      scale: 1.3
    },
    StarTrek: {
      label: 'Star Trek',
      logo: 'star-trek-logo.png',
      scale: 1.3
    },
    DoctorWho: {
      label: 'Doctor Who',
      logo: 'doctor-who-logo.png',
      scale: 1.3
    },
    AndyWeir: {
      label: 'Andy Weir'
    },
    MiddleEarth: {
      label: 'Middle-Earth',
      logo: 'middle-earth-logo.png',
      scale: 1.4
    },
    RiordanVerse: {
      label: 'RiordanVerse',
      logo: 'percy-jackson-logo.png',
      scale: 1.3
    },
    DCU: {
      label: 'DC Universe',
      logo: 'dcu-logo.png',
      scale: 1.3
    },
    BigBangTheory: {
      label: 'Big Bang Theory',
      logo: 'the-big-bang-theory-logo.png',
      scale: 1.3
    },
    Zelda: {
      label: 'The Legend of Zelda',
      logo: 'tloz-logo.png',
      scale: 1.4
    }
  };

  const franchiseBackdropMap = {
    MCU: 'mcu-backdrop.jpg',
    StarWars: 'star-wars-backdrop.jpg',
    StarTrek: 'star-trek-backdrop.jpg',
    DoctorWho: 'doctor-who-backdrop.jpg',
    AndyWeir: 'andy-weir-backdrop.jpg',
    MiddleEarth: 'middle-earth-backdrop.jpg',
    RiordanVerse: 'riordan-backdrop.jpg',
    DCU: 'dcu-backdrop.jpg',
    BigBangTheory: 'the-big-bang-theory-backdrop.jpg',
    Zelda: 'zelda-backdrop.jpg'
  };

  function updateFranchiseLogo(franchiseKey) {
    const logo = document.getElementById('franchiseLogo');
    const fallback = document.getElementById('franchiseLogoFallback');
    const brand = franchiseBrandMap[franchiseKey] || {
      label: franchiseKey.replace(/([A-Z])/g, ' $1').trim()
    };
    const logoScale = brand.scale || 1;
    const baseMaxWidth = 320;
    const baseMaxHeight = 80;

    const showFallback = function() {
      fallback.textContent = brand.label;
      fallback.style.display = 'block';
      logo.style.display = 'none';
      logo.style.opacity = '0';
      logo.removeAttribute('src');
    };

    fallback.style.display = 'none';
    logo.style.display = 'block';
    logo.alt = brand.label;
    logo.style.maxWidth = `${baseMaxWidth * logoScale}px`;
    logo.style.maxHeight = `${baseMaxHeight * logoScale}px`;
    logo.onerror = showFallback;

    if (!brand.logo) {
      if (brand.logoDataUri) {
        logo.src = brand.logoDataUri;
        return;
      }
      showFallback();
      return;
    }

    logo.style.opacity = '0';
    logo.removeAttribute('src');
    logo.onload = function() {
      logo.style.opacity = '1';
    };
    logo.src = `images/${brand.logo}`;
  }

  function updateFranchiseBackdrop(franchiseKey) {
    const backdropFile = franchiseBackdropMap[franchiseKey];
    const backdropValue = backdropFile
      ? typeof backdropFile === 'string'
        ? `url("images/${backdropFile}")`
        : `url("${backdropFile.folder}/${backdropFile.file}")`
      : 'none';
    document.body.style.setProperty('--page-backdrop', backdropValue);
  }

  function setActiveFranchiseButton(franchiseKey) {
    document.querySelectorAll('#franchiseHeadbar .franchise-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.franchise === franchiseKey);
    });
  }

  function renderFranchiseHeadbar() {
    const headbar = document.getElementById('franchiseHeadbar');
    const franchiseSelect = document.getElementById('franchiseSelect');
    if (!headbar || !franchiseSelect) return;

    headbar.innerHTML = '';
    Array.from(franchiseSelect.options).forEach(option => {
      const key = option.value;
      if (!key) return;
      const brand = franchiseBrandMap[key] || { label: option.textContent.trim() || key };
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'franchise-btn';
      btn.dataset.franchise = key;
      btn.title = brand.label || option.textContent.trim() || key;
      btn.setAttribute('aria-label', brand.label || option.textContent.trim() || key);
      btn.hidden = option.hidden;

      if (brand.logo) {
        const img = document.createElement('img');
        img.src = `images/${brand.logo}`;
        img.alt = brand.label || key;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.onerror = () => {
          img.remove();
          const text = document.createElement('span');
          text.className = 'franchise-btn-text';
          text.textContent = brand.label || option.textContent.trim() || key;
          btn.appendChild(text);
        };
        btn.appendChild(img);
      } else {
        const text = document.createElement('span');
        text.className = 'franchise-btn-text';
        text.textContent = brand.label || option.textContent.trim() || key;
        btn.appendChild(text);
      }

      btn.addEventListener('click', () => {
        selectFranchise(key);
      });

      headbar.appendChild(btn);
    });

    setActiveFranchiseButton(franchiseSelect.value);
  }

  function selectFranchise(franchiseKey, options = {}) {
    const { persist = true, force = false } = options;
    const franchiseSelect = document.getElementById('franchiseSelect');
    if (!franchiseSelect) return;

    const selected = franchiseKey || franchiseSelect.value || 'MCU';
    if (!force && franchiseSelect.value === selected) {
      setActiveFranchiseButton(selected);
      return;
    }

    franchiseSelect.value = selected;
    setActiveFranchiseButton(selected);
    if (persist) {
      localStorage.setItem('selectedFranchise', selected);
    }
    restoreSearchForFranchise(selected);
    updateFranchiseLogo(selected);
    updateFranchiseBackdrop(selected);
    loadFranchise(selected);
  }

  document.getElementById('franchiseSelect').addEventListener('change', (e) => {
    selectFranchise(e.target.value);
  });

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
    const currentFranchise = document.getElementById('franchiseSelect')?.value || '';
    const comicIcon = currentFranchise === 'MCU' ? 'images/marvel-comic.png' : 'images/comic.png';
    const juniorBookIcon = 'images/book-junior.png';
    const yaNovelIcon = 'images/novel-ya.png';
    const shortStoryIcon = 'images/short-story.png';
    const marvelComicIcon = 'images/marvel-comic.png';
    const darkHorseComicIcon = 'images/dark-horse-comic.png';
    const idwComicIcon = 'images/idw-comic.png';

    if (key.includes('comic (marvel)') || key.includes('marvel comic')) return marvelComicIcon;
    if (key.includes('comic (dark horse)') || key.includes('dark horse')) return darkHorseComicIcon;
    if (key.includes('comic (idw)') || key.includes('idw comic') || key.includes('(idw)')) return idwComicIcon;

    const directMap = {
      'movie': 'images/film.png',
      'film': 'images/film.png',
      'live action film': 'images/film.png',
      'live action series': 'images/tv-live.png',
      'tv episode': 'images/tv-live.png',
      'tv special': 'images/tv-live.png',
      'animated series': 'images/tv-animated.png',
      'animated tv': 'images/tv-animated.png',
      'animated tv (junior)': 'images/tv-animated.png',
      'junior animated series': 'images/tv-animated.png',
      'animated short': 'images/shorts.png',
      'animated shorts': 'images/shorts.png',
      'short': 'images/shorts.png',
      'shorts': 'images/shorts.png',
      'comic': comicIcon,
      'comic (marvel)': marvelComicIcon,
      'comic (dark horse)': darkHorseComicIcon,
      'comic (idw)': idwComicIcon,
      'manga': 'images/graphic-novel.png',
      'graphic novel': 'images/graphic-novel.png',
      'graphic novels': 'images/graphic-novel.png',
      'book (junior)': juniorBookIcon,
      'junior book': juniorBookIcon,
      'novel (young adult)': yaNovelIcon,
      'young adult novel': yaNovelIcon,
      'ya novel': yaNovelIcon,
      'short story': shortStoryIcon,
      'short stories': shortStoryIcon,
      'novel': 'images/novel.png',
      'audio drama': 'images/audio.png',
      'audio': 'images/audio.png',
      'video game': 'images/game.png',
      'game': 'images/game.png',
      'disney world attraction': 'images/disney-world.png',
      'book (junior)': 'images/book-junior.png'
    };

    if (directMap[key]) return directMap[key];

    if (key.includes('graphic novel') || key.includes('manga')) return 'images/graphic-novel.png';
    if (key.includes('short story')) return shortStoryIcon;
    if (key.includes('junior') && key.includes('book')) return juniorBookIcon;
    if ((key.includes('young adult') || /\bya\b/.test(key)) && (key.includes('novel'))) return yaNovelIcon;
    if (key.includes('comic') && key.includes('marvel')) return marvelComicIcon;
    if (key.includes('comic') && (key.includes('dark horse')|| key.endsWith(' dh'))) return darkHorseComicIcon;
    if (key.includes('comic') && (key.includes('idw') || key.includes('(idw)'))) return idwComicIcon;
    if (key.includes('comic')) return comicIcon;
    if (key.includes('novel')) return 'images/novel.png';
    if (key.includes('short') && !key.includes('short story')) return 'images/shorts.png';
    if (key.includes('audio')) return 'images/audio.png';
    if (key.includes('game')) return 'images/game.png';
    if (key.includes('animated')) return 'images/tv-animated.png';
    if (key.includes('series') || key.includes('tv') || key.includes('episode') || key.includes('special')) return 'images/tv-live.png';
    if (key.includes('film') || key.includes('movie')) return 'images/film.png';

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
          let universes = cardUniverse ? cardUniverse.split(',').map(u => u.trim()) : [];
          universes = universes.map(u => normalizeUniverseLabel(u, currentFranchise)).filter(Boolean);
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
    restoreTimelineScrollFromAnchor(scrollAnchor);
    // Update runtime counter
    updateRuntimeCounter();
    // Instantly update arrow visibility after filtering
    updateArrowVisibility();
    // Persist current filter state so refresh restores the same view
    persistFilterState(currentFranchise);
  }

  console.log('✅ PARSING SCRIPT LOADED');
  function repairMojibakeText(value) {
    if (typeof value !== 'string' || !value.includes('â')) return value;

    return value
      .replace(/â€¦/g, '...')
      .replace(/â€™/g, "'")
      .replace(/â€œ|â€\x9c/g, '"')
      .replace(/â€\x9d|â€/g, '"')
      .replace(/â€“/g, '-')
      .replace(/â€”/g, '--');
  }

  function normalizeReleaseDate(value) {
    if (value === null || value === undefined || value === '') return '';

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';

      if (trimmed.includes('?')) return trimmed;

      const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
      if (isoMatch) return trimmed;

      const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (slashMatch) {
        const [_, month, day, yearRaw] = slashMatch;
        const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      const dateTextMatch = trimmed.match(/^(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})$/);
      if (dateTextMatch) {
        const [, year, month, day] = dateTextMatch;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
      value = Number(trimmed);
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

    const serial = Math.floor(value);
    if (serial < 1) return String(value);

    const epoch = Date.UTC(1899, 11, 31);
    const days = serial > 59 ? serial - 1 : serial;
    const utcDate = new Date(epoch + (days * 86400000));
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function extractSeasonFromEpisode(episodeValue) {
    const raw = String(episodeValue || '').trim();
    if (!raw) return '';
    const match = raw.match(/\bS(\d+)\b/i);
    if (!match) return '';
    return `S${parseInt(match[1], 10)}`;
  }

  function getSeriesIdentifier(row) {
    const seasonToken = extractSeasonFromEpisode(row.episode || row['episode'] || '');
    if (seasonToken) {
      const seasonBaseTitle = row['serial title'] || row.title || '';
      return `${seasonBaseTitle}|${row.type}|${seasonToken}`;
    }
    if (row['serial title']) return row['serial title'];
    if (row.episode || row['episode title']) {
      return `${row.title}|${row.type}`;
    }
    return null;
  }

  function getSeriesFirstEntry(data) {
    const seriesMap = new Map();
    data.forEach((row, index) => {
      const seriesId = getSeriesIdentifier(row);
      if (!seriesId) return;

      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, []);
      }
      seriesMap.get(seriesId).push(index);
    });

    const representativeEntries = new Set();
    seriesMap.forEach((indices) => {
      indices.sort((a, b) => a - b);
      const medianIndex = indices[Math.floor((indices.length - 1) / 2)];
      representativeEntries.add(medianIndex);
    });
    return representativeEntries;
  }

  function getEpisodeOrderValue(episodeValue) {
    const raw = String(episodeValue || '').trim();
    if (!raw) return null;

    const patterns = [
      /\bE(?:P(?:ISODE)?)?\s*0*(\d+)\b/i,
      /#\s*0*(\d+)\b/i,
      /^0*(\d+)$/
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      const value = Number.parseInt(match[1], 10);
      if (!Number.isNaN(value)) return value;
    }

    return null;
  }

  function getSeriesPosterRows(data) {
    const posterRows = new Map();
    const fallbackRows = new Map();

    data.forEach((row) => {
      const seriesId = getSeriesIdentifier(row);
      if (!seriesId) return;

      if (!fallbackRows.has(seriesId)) {
        fallbackRows.set(seriesId, row);
      }

      const altPoster = typeof row['alt-poster'] === 'string'
        ? row['alt-poster'].trim()
        : '';
      const episodeOrder = getEpisodeOrderValue(row['episode'] || row.episode || '');
      if (altPoster && !posterRows.has(seriesId)) {
        posterRows.set(seriesId, row);
      } else if (episodeOrder === 1 && !posterRows.has(seriesId)) {
        posterRows.set(seriesId, row);
      }
    });

    fallbackRows.forEach((row, seriesId) => {
      if (!posterRows.has(seriesId)) {
        posterRows.set(seriesId, row);
      }
    });

    return posterRows;
  }

  function filterDataBySeriesMode(data, mode) {
    if (mode === 'episodic' || !data.some(row => getSeriesIdentifier(row))) {
      return data;
    }
    const firstEntries = getSeriesFirstEntry(data);
    return data.filter((row, index) => {
      const seriesId = getSeriesIdentifier(row);
      if (!seriesId) return true;
      return firstEntries.has(index);
    });
  }

  function getSeriesRuntimeTotals(data) {
    const runtimeTotals = new Map();
    data.forEach((row) => {
      const seriesId = getSeriesIdentifier(row);
      if (!seriesId) return;
      const minutes = parseInt(row.runtime, 10);
      if (Number.isNaN(minutes)) return;
      runtimeTotals.set(seriesId, (runtimeTotals.get(seriesId) || 0) + minutes);
    });
    return runtimeTotals;
  }

  function getSeriesItemCounts(data) {
    const countMetaBySeries = new Map();

    function getComicIssueIdentifier(row) {
      const episodeRaw = String(row['episode'] || row.episode || '').trim();
      if (episodeRaw) {
        const hashMatch = episodeRaw.match(/#\s*0*(\d+)\b/i);
        if (hashMatch) return `#${parseInt(hashMatch[1], 10)}`;
        const issueWordMatch = episodeRaw.match(/\bissue\s*#?\s*0*(\d+)\b/i);
        if (issueWordMatch) return `#${parseInt(issueWordMatch[1], 10)}`;
        return episodeRaw.toLowerCase();
      }

      const titleRaw = String(row.title || '').trim();
      if (titleRaw) return titleRaw.toLowerCase();
      const episodeTitleRaw = String(row['episode title'] || '').trim();
      if (episodeTitleRaw) return episodeTitleRaw.toLowerCase();
      return '';
    }

    data.forEach((row) => {
      const seriesId = getSeriesIdentifier(row);
      if (!seriesId) return;

      if (!countMetaBySeries.has(seriesId)) {
        countMetaBySeries.set(seriesId, {
          rowCount: 0,
          hasComicRows: false,
          issueIds: new Set()
        });
      }

      const meta = countMetaBySeries.get(seriesId);
      meta.rowCount += 1;

      const typeKey = normalizeTypeKey(row.type || '');
      if (typeKey.includes('comic')) {
        meta.hasComicRows = true;
        const issueId = getComicIssueIdentifier(row);
        if (issueId) {
          meta.issueIds.add(issueId);
        }
      }
    });

    const itemCounts = new Map();
    countMetaBySeries.forEach((meta, seriesId) => {
      const count = meta.hasComicRows && meta.issueIds.size > 0
        ? meta.issueIds.size
        : meta.rowCount;
      itemCounts.set(seriesId, count);
    });

    return itemCounts;
  }

  function parseReleaseDateForSort(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'Unknown' || raw.includes('?')) return null;
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      return Date.UTC(year, month - 1, day);
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function getSeriesEarliestReleaseDates(data) {
    const earliestDates = new Map();
    const earliestTimestamps = new Map();
    data.forEach((row) => {
      const seriesId = getSeriesIdentifier(row);
      if (!seriesId) return;
      const releaseDate = row['release date'];
      const parsedTime = parseReleaseDateForSort(releaseDate);
      if (parsedTime === null) {
        if (!earliestDates.has(seriesId) && releaseDate) {
          earliestDates.set(seriesId, releaseDate);
        }
        return;
      }
      const existing = earliestTimestamps.get(seriesId);
      if (existing === undefined || parsedTime < existing) {
        earliestTimestamps.set(seriesId, parsedTime);
        earliestDates.set(seriesId, releaseDate);
      }
    });
    return earliestDates;
  }

  function loadFranchise(franchiseKey) {
    const isStarWars = franchiseKey === 'StarWars';
    const file = franchiseFiles[franchiseKey];
    const sheetName = isStarWars ? franchiseWorksheetNames.StarWars[currentStarWarsContinuity] : null;

    restoreSearchForFranchise(franchiseKey);

    // Show/hide era section
    document.getElementById('eraSection').style.display = franchiseKey === 'StarWars' ? 'block' : 'none';
    updateContinuitySectionVisibility(franchiseKey);
    updateUniverseSectionVisibility(franchiseKey);
    document.getElementById('typeCheckboxes').style.display = '';
    if (wheelSnapRestoreTimer) {
      clearTimeout(wheelSnapRestoreTimer);
      wheelSnapRestoreTimer = null;
    }
    timeline.style.scrollSnapType = 'x mandatory';
    syncContinuityButtons();

    // Clear timeline and filters immediately
    timeline.innerHTML = '';
    document.getElementById('universeCheckboxes').innerHTML = '';
    document.getElementById('typeCheckboxes').innerHTML = '';
    document.getElementById('eraFilters').innerHTML = '';
    document.getElementById('noResults').style.display = 'none';

    const parseError = function() {
      timeline.innerHTML = '';
      document.getElementById('universeCheckboxes').innerHTML = '';
      document.getElementById('typeCheckboxes').innerHTML = '';
      document.getElementById('eraFilters').innerHTML = '';
      document.getElementById('noResults').style.display = 'block';
      currentData = [];
    };

    function fetchAndParseWorkbook(xlsxFile, requestedSheet) {
      if (typeof XLSX === 'undefined') {
        parseError();
        return;
      }

      fetch(xlsxFile)
        .then(function(response) {
          if (!response.ok) throw new Error('Unable to fetch workbook');
          return response.arrayBuffer();
        })
        .then(function(buffer) {
          const workbook = XLSX.read(buffer, { type: 'array' });
          let sheet;
          if (requestedSheet) {
            sheet = workbook.Sheets[requestedSheet] || workbook.Sheets[requestedSheet.toUpperCase()] || workbook.Sheets[requestedSheet.toLowerCase()];
          } else {
            sheet = workbook.Sheets[workbook.SheetNames[0]];
          }
          if (!sheet) throw new Error('Sheet not found');
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          parseComplete({ data: rows });
        })
        .catch(parseError);
    }

    fetchAndParseWorkbook(file, sheetName);

    function parseComplete(results) {
        // Normalize type field for all rows (handle both 'type' and 'Type')
        let data = results.data.map((row, index) => {
          Object.keys(row).forEach((key) => {
            row[key] = repairMojibakeText(row[key]);
          });
          row.type = row.type || row.Type || '';
          row['release date'] = normalizeReleaseDate(row['release date']);
          row.__originalIndex = index;
          const sourceId = (row.id || row.ID || '').toString().trim();
          row.__itemKey = sourceId || `${franchiseKey}|${index}|${row.title || ''}|${row['episode'] || ''}|${row['episode title'] || ''}|${row['serial title'] || ''}`;
          return row;
        });

        if (isStarWars && currentStarWarsContinuity === 'Canon') {
          data = data.filter(row => String(row['universe number'] ?? '').trim().toLowerCase() !== 'legends');
        }
        if (isStarWars && currentStarWarsContinuity === 'Legends') {
          data = data.filter(row => String(row['universe number'] ?? '').trim().toLowerCase() === 'legends');
        }

        // If no data or only empty rows, show no results
        if (!data || !Array.isArray(data) || data.length === 0 || (data.length === 1 && Object.values(data[0]).every(v => !v))) {
          timeline.innerHTML = '';
          document.getElementById('universeCheckboxes').innerHTML = '';
          document.getElementById('typeCheckboxes').innerHTML = '';
          document.getElementById('eraFilters').innerHTML = '';
          document.getElementById('noResults').style.display = 'block';
          currentData = [];
          return;
        }

        // --- DYNAMIC TYPE CHECKBOXES ---
        const typeContainer = document.getElementById('typeCheckboxes');
        typeContainer.innerHTML = '';
        let primaryTypeContainer = typeContainer;
        let kidsTypeContainer = typeContainer;

        if (franchiseKey === 'StarWars') {
          const sectionsWrapper = document.createElement('div');
          sectionsWrapper.className = 'type-sections';

          primaryTypeContainer = document.createElement('div');
          primaryTypeContainer.className = 'type-section';

          kidsTypeContainer = document.createElement('div');
          kidsTypeContainer.className = 'type-section type-kids-section';

          const kidsLabel = document.createElement('div');
          kidsLabel.className = 'type-section-label';
          kidsLabel.textContent = 'Kids';

          sectionsWrapper.appendChild(primaryTypeContainer);
          sectionsWrapper.appendChild(kidsLabel);
          sectionsWrapper.appendChild(kidsTypeContainer);
          typeContainer.appendChild(sectionsWrapper);
        }

        const types = Array.from(new Set(data.map(row => row.type).filter(Boolean)));
        if (franchiseKey === 'StarWars') {
          types.sort((a, b) => {
            const bucketDiff = getStarWarsTypeSortBucket(a) - getStarWarsTypeSortBucket(b);
            if (bucketDiff !== 0) return bucketDiff;
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
          });
        } else {
          types.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        }
        types.forEach((type) => {
          const btn = document.createElement('label');
          btn.className = 'toggle-btn selected type-filter-btn';
          btn.title = type;
          btn.setAttribute('aria-label', type);
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = type;
          checkbox.checked = true;
          btn.appendChild(checkbox);

          const iconSrc = getTypeIconForType(type);
          if (iconSrc) {
            const icon = document.createElement('img');
            icon.className = 'type-icon';
            icon.src = iconSrc;
            icon.alt = '';
            icon.loading = 'lazy';
            icon.decoding = 'async';
            icon.addEventListener('error', () => icon.remove());
            btn.classList.add('has-type-mask');
            btn.style.setProperty('--type-icon-mask', `url("${iconSrc}")`);
            btn.appendChild(icon);
          }

          const label = document.createElement('span');
          label.className = 'type-label';
          label.textContent = type;
          btn.appendChild(label);

          if (franchiseKey === 'StarWars' && isKidsType(type)) {
            kidsTypeContainer.appendChild(btn);
          } else {
            primaryTypeContainer.appendChild(btn);
          }
        });
        // Restore type filter state from localStorage
        const typeFilterKey = `typeFilters-${franchiseKey}`;
        const savedTypeFilters = JSON.parse(localStorage.getItem(typeFilterKey) || 'null');
        if (savedTypeFilters) {
          document.querySelectorAll('#typeCheckboxes input[type="checkbox"]').forEach(cb => {
            cb.checked = savedTypeFilters.includes(cb.value);
          });
        } else if (franchiseKey === 'StarWars') {
          document.querySelectorAll('#typeCheckboxes input[type="checkbox"]').forEach(cb => {
            if (isKidsType(cb.value)) cb.checked = false;
          });
        }
        if (franchiseKey === 'StarWars' && document.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked').length === 0) {
          document.querySelectorAll('#typeCheckboxes input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
          });
        }
        // Add event listeners for new type checkboxes
        document.querySelectorAll('#typeCheckboxes .toggle-btn').forEach(btn => {
          const cb = btn.querySelector('input[type="checkbox"]');
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target === cb) return; // let input handle
            cb.checked = !cb.checked;
            btn.classList.toggle('selected', cb.checked);
            const checkedTypes = Array.from(document.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem(typeFilterKey, JSON.stringify(checkedTypes));
            applyFilters();
          });
          // Initial state
          btn.classList.toggle('selected', cb.checked);
          cb.addEventListener('change', (e) => {
            e.stopPropagation();
            btn.classList.toggle('selected', cb.checked);
            const checkedTypes = Array.from(document.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem(typeFilterKey, JSON.stringify(checkedTypes));
            applyFilters();
          });
        });
        // --- END DYNAMIC TYPE CHECKBOXES ---

        // rebuild universe filters
        const universeContainer = document.getElementById('universeCheckboxes');
        universeContainer.innerHTML = '';

        // Collect all universes, splitting on comma for multi-universe entries
        const universeSet = new Set();
        data.forEach(row => {
          const uni = row['universe number'];
          if (uni === null || uni === undefined || uni === '') return;
          String(uni).split(',').forEach(u => {
            let trimmed = normalizeUniverseLabel(u, franchiseKey);
            if (trimmed) universeSet.add(trimmed);
          });
        });
        const universes = Array.from(universeSet).sort();

        universes.forEach(u => {
          const btn = document.createElement('label');
          btn.className = 'toggle-btn selected';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = u;
          checkbox.checked = true;
          btn.appendChild(checkbox);
          btn.appendChild(document.createTextNode(u));
          universeContainer.appendChild(btn);
        });

        // Restore universe filter state from localStorage
        const universeFilterKey = `universeFilters-${franchiseKey}`;
        const savedUniverseFilters = JSON.parse(localStorage.getItem(universeFilterKey) || 'null');
        if (savedUniverseFilters) {
          document.querySelectorAll('#universeCheckboxes input[type="checkbox"]').forEach(cb => {
            cb.checked = savedUniverseFilters.includes(cb.value);
          });
        }
        // Add event listeners for universe checkboxes
        document.querySelectorAll('#universeCheckboxes .toggle-btn').forEach(btn => {
          const cb = btn.querySelector('input[type="checkbox"]');
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target === cb) return;
            cb.checked = !cb.checked;
            btn.classList.toggle('selected', cb.checked);
            const checkedUniverses = Array.from(document.querySelectorAll('#universeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem(universeFilterKey, JSON.stringify(checkedUniverses));
            applyFilters();
          });
          btn.classList.toggle('selected', cb.checked);
          cb.addEventListener('change', (e) => {
            e.stopPropagation();
            btn.classList.toggle('selected', cb.checked);
            const checkedUniverses = Array.from(document.querySelectorAll('#universeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem(universeFilterKey, JSON.stringify(checkedUniverses));
            applyFilters();
          });
        });
        // --- END DYNAMIC UNIVERSE CHECKBOXES ---

        // --- DYNAMIC ERA BUTTONS (Star Wars specific) ---
        const eraContainer = document.getElementById('eraFilters');
        eraContainer.innerHTML = '';
        const eras = Array.from(new Set(data.map(row => row['Era']).filter(Boolean)));
        // Sort by timeline order (first appearance in timeline)
        eras.sort((a, b) => {
          const aMinTimeline = Math.min(...data.filter(row => row['Era'] === a).map(row => parseInt(row['timeline number']) || Infinity));
          const bMinTimeline = Math.min(...data.filter(row => row['Era'] === b).map(row => parseInt(row['timeline number']) || Infinity));
          return aMinTimeline - bMinTimeline;
        });
        eras.forEach(era => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'era-btn selected';
          btn.dataset.era = era;
          btn.title = era;
          btn.setAttribute('aria-label', era);
          const img = document.createElement('img');
          const logoCandidates = getEraLogoCandidates(era);
          let logoIndex = 0;
          img.src = `images/${logoCandidates[logoIndex]}`;
          img.alt = era;
          btn.classList.add('has-era-mask');
          btn.style.setProperty('--era-icon-mask', `url("images/${logoCandidates[logoIndex]}")`);
          img.onerror = function() {
            logoIndex += 1;
            if (logoIndex < logoCandidates.length) {
              img.src = `images/${logoCandidates[logoIndex]}`;
              btn.style.setProperty('--era-icon-mask', `url("images/${logoCandidates[logoIndex]}")`);
              return;
            }
            btn.classList.remove('has-era-mask');
            btn.textContent = era;
          };
          btn.appendChild(img);
          btn.addEventListener('click', () => {
            btn.classList.toggle('selected');
            applyFilters();
          });
          eraContainer.appendChild(btn);
        });
        // Restore era filter state
        restoreEraFilters(franchiseKey);
        restoreCheckedStateFilter(franchiseKey);
        // --- END DYNAMIC ERA BUTTONS ---

        currentData = data.slice();

        // apply current sort mode
        sortCards(currentData, sortMode);
        sessionStorage.removeItem(SCROLL_KEY);
        localStorage.removeItem('filters');
        renderCards(currentData);
        updateRuntimeCounter();
    }
  }

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
      sortCards(currentData, sortMode);
      // ✅ SAVE IT
      localStorage.setItem('sortMode', sortMode);
      updateSortButtonLabel();

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
