  let currentData = [];
  let sortMode = 'timeline'; // 'timeline' or 'release'
  let seriesViewMode = localStorage.getItem('seriesViewMode') || 'episodic'; // 'episodic' or 'series'
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

    const startVariants = ['setting - starts', 'setting starts', 'settingstarts', 'start date', 'startdate', 'start_date', 'start', 'starts'];
    const endVariants = ['setting - ends', 'setting ends', 'settingends', 'end date', 'enddate', 'end_date', 'end', 'ends'];
    const startValue = formatDateValue(findRowValue(startVariants));
    const endValue = formatDateValue(findRowValue(endVariants));

    return { startValue, endValue };
  }

  function formatTimelineDisplayValue(value) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (value === null || value === undefined) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (lowered === 'unknown' || lowered === 'none' || lowered === 'n/a' || lowered === 'null') return '';

    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*(?:AM|PM))?)?$/i);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      if (year && month && day) {
        return `${monthNames[month - 1] || month} ${day}, ${year}`;
      }
    }

    return trimmed;
  }

  function formatTimelineRange(startValue, endValue) {
    if (!startValue) return endValue;
    if (!endValue) return startValue;
    if (startValue === endValue) return startValue;

    const parseDate = (value) => {
      const match = String(value).match(/^([A-Za-z]+)(?:\s+(\d{1,2}))?,\s*(\d{4})$/);
      if (!match) return null;
      return { month: match[1], day: match[2] || '', year: match[3] };
    };

    const start = parseDate(startValue);
    const end = parseDate(endValue);
    if (!start || !end || start.year !== end.year) {
      return `${startValue} - ${endValue}`;
    }

    if (!start.day || !end.day) {
      if (start.month === end.month) return `${start.month}, ${start.year}`;
      return `${start.month} - ${end.month}, ${start.year}`;
    }

    if (start.month === end.month) {
      return `${start.month} ${start.day} - ${end.day}, ${start.year}`;
    }
    return `${start.month} ${start.day} - ${end.month} ${end.day}, ${start.year}`;
  }

  function getInUniverseTimeLabel(row, franchiseKey) {
    const { startValue, endValue } = getTimelineStartEndValues(row, franchiseKey);

    const formattedStartValue = formatTimelineDisplayValue(startValue);
    const formattedEndValue = formatTimelineDisplayValue(endValue);

    if (formattedStartValue && formattedEndValue) return formatTimelineRange(formattedStartValue, formattedEndValue);
    if (formattedStartValue) {
      return formattedStartValue;
    }
    if (formattedEndValue) {
      return formattedEndValue;
    }

    if (franchiseKey === 'StarWars') {
      const candidates = [row['Galactic Year'], row['in-universe time'], row['in universe time']];
      for (const candidate of candidates) {
        const formatted = formatTimelineDisplayValue(candidate);
        if (formatted) return formatted;
      }
    } else if (franchiseKey === 'StarTrek') {
      const candidates = [row['Gregorian Calendar Year'], row['gregorian calendar year'], row['Stardate'], row['stardate']];
      for (const candidate of candidates) {
        const formatted = formatTimelineDisplayValue(candidate);
        if (formatted) return formatted;
      }
    } else {
      const candidates = [row['Setting'], row['setting']];
      for (const candidate of candidates) {
        const formatted = formatTimelineDisplayValue(candidate);
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
      return {
        startValue: formatTimelineDisplayValue(startValue),
        endValue: formatTimelineDisplayValue(endValue)
      };
    }
    if (startValue) {
      return {
        startValue: formatTimelineDisplayValue(startValue),
        endValue: ''
      };
    }
    return {
      startValue: '',
      endValue: formatTimelineDisplayValue(endValue)
    };
  }

  function renderCardTimelineTrack(card, row, franchiseKey, dataRows) {
    if (sortMode !== 'timeline') return null;

    let label = getInUniverseTimeLabel(row, franchiseKey);
    const seriesId = getSeriesIdentifier(row);
    if (seriesViewMode === 'series' && seriesId && Array.isArray(dataRows)) {
      const seriesRange = getSeriesTimelineRangeValues(dataRows, franchiseKey, seriesId);
      if (seriesRange) {
        const combinedLabel = formatTimelineRange(seriesRange.startValue, seriesRange.endValue);
        if (combinedLabel) {
          label = combinedLabel;
        }
      }
    }

    if (!label) return null;

    const labelEl = document.createElement('div');
    labelEl.className = 'card-time-track-label';
    labelEl.textContent = `Takes Place: ${label}`;
    return labelEl;
  }

  // Arrow visibility update function (hoisted for use in applyFilters)
