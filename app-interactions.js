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

  document.addEventListener('touchstart', (event) => {
    if (!isTouchInteractionMode()) return;
    if (event.target.closest('.card')) return;
    closeAllTouchCardStates();
  }, { passive: true });

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
  }, { passive: false });
  // --- END SAVE/RESTORE ---

