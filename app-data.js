  function repairMojibakeText(value) {
    if (typeof value !== 'string' || !/[ÃÂâ]/.test(value)) return value;

    try {
      const encoded = Array.from(value, (character) => {
        const code = character.charCodeAt(0);
        return code <= 0xff ? `%${code.toString(16).padStart(2, '0')}` : character;
      }).join('');
      const repaired = decodeURIComponent(encoded);
      if (repaired !== value) return repaired;
    } catch {
      // Keep the original text when it is not valid UTF-8 mojibake.
    }

    return value
      .replace(/Ã¢â‚¬Â¦/g, '...')
      .replace(/Ã¢â‚¬â„¢/g, "'")
      .replace(/Ã¢â‚¬Å“|Ã¢â‚¬\x9c/g, '"')
      .replace(/Ã¢â‚¬\x9d|Ã¢â‚¬/g, '"')
      .replace(/Ã¢â‚¬â€œ/g, '-')
      .replace(/Ã¢â‚¬â€/g, '--');
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

  function getSeriesCollapseExceptionSuffix(row) {
    const baseTitle = String(row?.['serial title'] || row?.title || '').trim();
    const normalizedTitle = normalizeTmdbTitleForMatch(baseTitle);
    if (normalizedTitle === 'incredible hulk 1977') {
      return '|live-action';
    }

    return '';
  }

  function getSeriesIdentifier(row) {
    const collapseExceptionSuffix = getSeriesCollapseExceptionSuffix(row);
    const seasonToken = extractSeasonFromEpisode(row.episode || row['episode'] || '');
    if (seasonToken) {
      const seasonBaseTitle = row['serial title'] || row.title || '';
      return `${seasonBaseTitle}|${row.type}|${seasonToken}${collapseExceptionSuffix}`;
    }
    if (row['serial title']) return `${row['serial title']}${collapseExceptionSuffix}`;
    if (row.episode || row['episode title']) {
      return `${row.title}|${row.type}${collapseExceptionSuffix}`;
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

