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
      label: 'DC Studios',
      logo: 'dcu-logo.png',
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
    MiddleEarth: 'middle-earth-backdrop.jpg',
    RiordanVerse: 'riordan-backdrop.jpg',
    DCU: 'dcu-backdrop.jpg',
    Zelda: 'zelda-backdrop.jpg'
  };

  function formatFranchiseUpdatedText(timestamp) {
    if (!timestamp) return 'Last updated: â€”';
    const parsedDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(parsedDate.getTime())) return 'Last updated: â€”';
    const formattedDate = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(parsedDate);
    return `Last updated: ${formattedDate}`;
  }

  function updateFranchiseUpdatedLabel(franchiseKey) {
    const label = document.getElementById('franchiseUpdatedLabel');
    if (!label) return;

    const workbookFile = franchiseFiles[franchiseKey];
    if (!workbookFile) {
      label.textContent = 'Last updated: â€”';
      label.style.display = 'none';
      return;
    }

    label.textContent = 'Last updated: â€¦';
    label.style.display = 'block';

    const workbookUrl = new URL(workbookFile, window.location.href).toString();
    fetch(workbookUrl, { method: 'HEAD' })
      .then((response) => {
        const lastModified = response.headers.get('Last-Modified');
        label.textContent = formatFranchiseUpdatedText(lastModified);
        label.style.display = 'block';
      })
      .catch(() => {
        label.textContent = 'Last updated: â€”';
        label.style.display = 'block';
      });
  }

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

    const applyLogoSrc = function(src) {
      if (!src) return;
      fallback.style.display = 'none';
      logo.style.display = 'block';
      logo.style.opacity = '0';
      logo.removeAttribute('src');
      logo.onload = function() {
        logo.style.opacity = '1';
      };
      logo.src = src;
    };

    const localLogoSrc = brand.logoDataUri || (brand.logo ? `images/${brand.logo}` : '');
    if (localLogoSrc) {
      applyLogoSrc(localLogoSrc);
    } else {
      showFallback();
    }

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
    updateFranchiseUpdatedLabel(selected);
    updateFranchiseBackdrop(selected);
    loadFranchise(selected);
  }

  document.getElementById('franchiseSelect').addEventListener('change', (e) => {
    selectFranchise(e.target.value);
  });

