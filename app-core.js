  window.franchiseFiles = {
    MCU: 'MCU.xlsx',
    StarWars: 'STARWARS.xlsx',
    StarTrek: 'STARTREK.xlsx',
    DoctorWho: 'DOCTORWHO.xlsx',
    MiddleEarth: 'MIDDLEEARTH.xlsx',
    RiordanVerse: 'RIORDANVERSE.xlsx',
    DCU: 'DCU.xlsx',
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
  function buildTmdbPageUrl(mediaType, id, seasonNumber = null) {
    const numericId = Number.parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) return '';
    if (mediaType === 'tv') {
      if (Number.isFinite(seasonNumber) && seasonNumber >= 0) {
        return `https://www.themoviedb.org/tv/${numericId}/season/${seasonNumber}`;
      }
      return `https://www.themoviedb.org/tv/${numericId}`;
    }
    return `https://www.themoviedb.org/movie/${numericId}`;
  }

  function getRowValueByVariants(row, variants) {
    if (!row || !variants || !variants.length) return '';
    const keys = Object.keys(row);
    for (const key of keys) {
      const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]+/g, '');
      const matches = variants.some((variant) => normalizedKey === String(variant).toLowerCase().replace(/[^a-z0-9]+/g, ''));
      if (!matches) continue;
      const value = row[key];
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  function getComicVineUrlForRow(row) {
    const value = getRowValueByVariants(row, ['comic vine url', 'comicvine url']);
    return /^https?:\/\/\S+$/i.test(value) ? value : '';
  }

  function parseTmdbPathReference(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    let path = raw;
    if (/^https?:\/\//i.test(path)) {
      try {
        path = new URL(path).pathname || '';
      } catch {
        path = raw;
      }
    }

    const normalizedPath = String(path).trim();
    const seasonMatch = normalizedPath.match(/\/?(tv)\/(\d+)\/season\/(\d+)/i);
    if (seasonMatch) {
      const mediaType = seasonMatch[1].toLowerCase();
      const id = Number.parseInt(seasonMatch[2], 10);
      const seasonNumber = Number.parseInt(seasonMatch[3], 10);
      if (Number.isFinite(id) && id > 0 && Number.isFinite(seasonNumber) && seasonNumber > 0) {
        return { mediaType, id, seasonNumber };
      }
    }

    const mediaMatch = normalizedPath.match(/\/?(tv|movie)\/(\d+)/i);
    if (mediaMatch) {
      const mediaType = mediaMatch[1].toLowerCase();
      const id = Number.parseInt(mediaMatch[2], 10);
      if (Number.isFinite(id) && id > 0) {
        return { mediaType, id, seasonNumber: null };
      }
    }

    return null;
  }

  function isSpecialLikelyTvRow(row) {
    const hasSeasonNumber = Number.isFinite(getSeasonNumberFromRow(row));
    const episodeValue = String(row?.episode || '').trim();
    const hasEpisodeToken = /s\d{1,3}\s*e\d{1,3}|\bepisode\b|\bep\b/i.test(episodeValue);
    const serialTitle = String(row?.['serial title'] || '').trim();
    const title = String(row?.title || '').trim();
    const hasDistinctSeriesTitle = !!(serialTitle && title && normalizeTmdbTitleForMatch(serialTitle) !== normalizeTmdbTitleForMatch(title));

    return hasSeasonNumber || hasEpisodeToken || hasDistinctSeriesTitle;
  }

  function inferTmdbMediaTypeFromRow(row) {
    const typeKey = String(row?.type || '').toLowerCase();
    if (typeKey.includes('special')) {
      return isSpecialLikelyTvRow(row) ? 'tv' : 'movie';
    }
    if (typeKey.includes('tv') || typeKey.includes('series') || typeKey.includes('episode') || typeKey.includes('doctor who') || typeKey.includes('short')) {
      return 'tv';
    }
    return 'movie';
  }

  function isTmdbEligibleMediaType(row) {
    const typeKey = String(row?.type || '').toLowerCase();
    if (!typeKey) return false;

    const isMovieLike = typeKey.includes('movie') || typeKey.includes('film') || typeKey.includes('special');
    const isTvLike = typeKey.includes('tv') || typeKey.includes('series') || typeKey.includes('episode') || typeKey.includes('doctor who') || typeKey.includes('short');
    return isMovieLike || isTvLike;
  }

  function getSeasonNumberFromRow(row) {
    if (!row) return null;
    const directSeason = getRowValueByVariants(row, ['season number', 'season', 'season_number']);
    const seasonToken = directSeason || extractSeasonFromEpisode(row?.episode || row?.['episode'] || '');
    const match = String(seasonToken || '').trim().match(/(?:^|\b)S?(\d{1,3})(?:\b|$)/i);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function normalizeTmdbTitleForMatch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(the|a|an)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getTmdbLookupForRow(row) {
    if (!isTmdbEligibleMediaType(row)) return null;

    const explicitIdRaw = getRowValueByVariants(row, [
      'tmdb directory',
      'tmdb path',
      'tmdb url',
      'tmdb id',
      'tmdbid',
      'tmdb_id',
      'themoviedb directory',
      'themoviedb path',
      'themoviedb url',
      'themoviedb id',
      'themoviedbid'
    ]);
    const explicitTypeRaw = getRowValueByVariants(row, ['tmdb type', 'tmdbtype', 'tmdb_type']);
    const explicitPathReference = parseTmdbPathReference(explicitIdRaw);
    const explicitId = Number.parseInt(explicitIdRaw, 10);
    const explicitType = explicitTypeRaw.toLowerCase() === 'tv' ? 'tv' : (explicitTypeRaw.toLowerCase() === 'movie' ? 'movie' : '');
    const mediaType = explicitType || explicitPathReference?.mediaType || inferTmdbMediaTypeFromRow(row);
    const seasonNumber = mediaType === 'tv' ? getSeasonNumberFromRow(row) : null;
    const hasExplicitId = Number.isFinite(explicitId) && explicitId > 0;

    if (explicitPathReference?.id) {
      const resolvedMediaType = explicitPathReference.mediaType || mediaType;
      const resolvedSeasonNumber = resolvedMediaType === 'tv'
        ? (Number.isFinite(explicitPathReference.seasonNumber) ? explicitPathReference.seasonNumber : seasonNumber)
        : null;

      return {
        mediaType: resolvedMediaType,
        id: explicitPathReference.id,
        seasonNumber: resolvedSeasonNumber
      };
    }

    if (hasExplicitId) {
      return {
        mediaType,
        id: explicitId,
        seasonNumber
      };
    }

    return null;
  }

  function getTmdbPageUrlForRow(row) {
    if (!isTmdbEligibleMediaType(row)) return '';

    const explicitUrl = getRowValueByVariants(row, ['tmdb url', 'tmdburl', 'tmdb_url', 'themoviedb url', 'themoviedburl']);
    if (explicitUrl) return explicitUrl;

    const lookup = getTmdbLookupForRow(row);
    if (lookup?.id) {
      return buildTmdbPageUrl(lookup.mediaType, lookup.id, lookup.seasonNumber);
    }

    return '';
  }

