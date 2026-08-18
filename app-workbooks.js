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

      fetch(xlsxFile, { cache: 'no-store' })
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
          const hasUniverseNumberColumn = data.some(row => Object.prototype.hasOwnProperty.call(row, 'universe number'));
          if (hasUniverseNumberColumn) {
            data = data.filter(row => String(row['universe number'] ?? '').trim().toLowerCase() !== 'legends');
          }
        }
        if (isStarWars && currentStarWarsContinuity === 'Legends') {
          const hasUniverseNumberColumn = data.some(row => Object.prototype.hasOwnProperty.call(row, 'universe number'));
          if (hasUniverseNumberColumn) {
            data = data.filter(row => String(row['universe number'] ?? '').trim().toLowerCase() === 'legends');
          }
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

