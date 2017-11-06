import { CachedEventRegistry } from './cached_event_registry';

export class Siema {
    /**
     * Create a Siema.
     * @param {Object} options - Optional settings object.
     */
  constructor(options) {
        // Merge defaults with user's settings
    this._config = Siema.mergeSettings(options);
    this._eventRegistry = new CachedEventRegistry();

        // Resolve selector's type
    this._selector = typeof this._config.selector === 'string' ? document.querySelector(this._config.selector) : this._config.selector;

        // Early throw if selector doesnt exists
    if (this._selector === null) {
      throw new Error('Something wrong with your selector 😭');
    }

    const supportsNativeTransform = Siema._supportsTransform();
    this._transitionProperty = supportsNativeTransform ? 'transition' : 'WebkitTransition';
    this._transformProperty = supportsNativeTransform ? 'transform' : 'WebkitTransform';

    this._innerElements = Array.from(this._selector.children);
    this._resetFrameSlides();

        // Bind all event handlers to this context
    this._resizeHandler = this._resizeHandler.bind(this);
    this._touchstartHandler = this._touchstartHandler.bind(this);
    this._touchendHandler = this._touchendHandler.bind(this);
    this._touchmoveHandler = this._touchmoveHandler.bind(this);
    this._mousedownHandler = this._mousedownHandler.bind(this);
    this._mouseupHandler = this._mouseupHandler.bind(this);
    this._mouseleaveHandler = this._mouseleaveHandler.bind(this);
    this._mousemoveHandler = this._mousemoveHandler.bind(this);

    this._attachEvents();

    this._setCurrentSlide(0);
    this._slideToCurrent();
  }

  static transition(duration, easing) {
    return `transform ${duration}ms ${easing}`;
  }

  static translate(x = 0, y = 0, z = 0) {
    return `translate3d(${x}px, ${y}px, ${z}px)`;
  }

  static get GRAB_CURSOR() {
    return '-webkit-grab';
  }

  static get GRABBING_CURSOR() {
    return '-webkit-grabbing';
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static closest(value, array) {
    return array.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev));
  }

  onChange(callback) {
    return this._eventRegistry.listen(callback);
  }

    /**
     * Overrides default settings with custom ones.
     * @param {Object} options - Optional settings object.
     * @returns {Object} - Custom Siema settings.
     */
  static mergeSettings(options) {
    return Object.assign({}, {
      selector: undefined,
      duration: 200,
      easing: 'ease-out',
      stickToEdges: true,
      draggable: true
    }, options);
  }


    /**
     * Determine if browser supports un-prefixed transform property.
     */
  static _supportsTransform() {
    const style = document.documentElement.style;
    return typeof style.transform === 'string';

  }

  get currentSlide() {
    return this._currentSlide;
  }

    /**
     * Go to previous slide.
     * @param {number} [howManySlides=1] - How many items to slide backward.
     */
  prev(howManySlides = 1) {
    return this.moveBy(-howManySlides);
  }

    /**
     * Go to next slide.
     * @param {number} [howManySlides=1] - How many items to slide forward.
     */
  next(howManySlides = 1) {
    this.moveBy(howManySlides);
  }

    /**
     * Moves the current slide by a relative amount (positive of negative)
     * @param {number} [howManySlides=1] - How many items to slide (can be negative).
     */
  moveBy(howManySlides) {
    return this.goTo(Siema.clamp(this.currentSlide + howManySlides, 0, this._innerSlides.length));
  }

    /**
     * Go to slide with particular index
     * @param {number} index - Item index to slide to
     */
  goTo(index) {
    const beforeChange = this._currentSlide;
    this._setCurrentSlide(Siema.clamp(index, 0, this._innerElements.length));
    if (beforeChange !== this._currentSlide) {
      this._slideToCurrent();
    }
  }

    /**
     * Remove item from carousel.
     * @param {number} index - Item index to remove.
     */
  remove(index) {
    if (index < 0 || index >= this._innerElements.length) {
      throw new Error('Item to remove doesn\'t exist 😭');
    }
        // Avoid shifting content
    this._setCurrentSlide(index <= this._currentSlide ? this._currentSlide - 1 : this._currentSlide);
    this._innerElements.splice(index, 1);
    this._resetFrameSlides();
  }

    /**
     * Insert item to carousel at particular index.
     * @param {Element} item - Item to insert.
     * @param {number} index - Index of new new item insertion.
     */
  insert(item, index) {
    if (index < 0 || index > this._innerElements.length + 1) {
      throw new Error('Unable to inset it at this index 😭');
    }
    if (this._innerElements.indexOf(item) !== -1) {
      throw new Error('The same item in a carousel? Really? Nope 😭');
    }
        // Avoid shifting content
    this._setCurrentSlide(index <= this._currentSlide ? this._currentSlide + 1 : this._currentSlide);
    this._innerElements.splice(index, 0, item);
    this._resetFrameSlides();
  }

    /**
     * Prepend item to carousel.
     * @param {Element} item - Item to prepend.
     */
  prepend(item) {
    this.insert(item, 0);
  }

    /**
     * Append item to carousel.
     * @param {Element} item - Item to append.
     */
  append(item) {
    this.insert(item, this._innerElements.length + 1);
  }

    /**
     * Removes listeners and optionally restores to initial markup
     * @param {boolean} restoreMarkup - Determinants about restoring an initial markup.
     */
  destroy(restoreMarkup = false) {
    this._detachEvents();

    if (restoreMarkup) {
      this._selector.innerHTML = '';
      const fragment = document.createDocumentFragment();
      this._innerElements.forEach(el => fragment.appendChild(el));
      this._selector.appendChild(fragment);
      this._selector.removeAttribute('style');
    }
  }


  _setCurrentSlide(slide) {
    this._currentSlide = slide;
    this._eventRegistry.notify(this._currentSlide);
  }

  _attachEvents() {
        // Resize element on window resize
    window.addEventListener('resize', this._resizeHandler);

        // If element is draggable / swipable, add event handlers
    if (this._config.draggable) {
            // Keep track pointer hold and dragging distance
      this._pointerDown = false;
      this._drag = {
        startX: 0,
        endX: 0,
        startY: 0,
        letItGo: null
      };

            // Touch events
      this._selector.addEventListener('touchstart', this._touchstartHandler, { passive: true });
      this._selector.addEventListener('touchend', this._touchendHandler);
      this._selector.addEventListener('touchmove', this._touchmoveHandler, { passive: true });

            // Mouse events
      this._selector.addEventListener('mousedown', this._mousedownHandler);
      this._selector.addEventListener('mouseup', this._mouseupHandler);
      this._selector.addEventListener('mouseleave', this._mouseleaveHandler);
      this._selector.addEventListener('mousemove', this._mousemoveHandler);
    }
  }

  _detachEvents() {
    window.removeEventListener('resize', this._resizeHandler);
    this._selector.style.cursor = 'auto';
    this._selector.removeEventListener('touchstart', this._touchstartHandler);
    this._selector.removeEventListener('touchend', this._touchendHandler);
    this._selector.removeEventListener('touchmove', this._touchmoveHandler);
    this._selector.removeEventListener('mousedown', this._mousedownHandler);
    this._selector.removeEventListener('mouseup', this._mouseupHandler);
    this._selector.removeEventListener('mouseleave', this._mouseleaveHandler);
    this._selector.removeEventListener('mousemove', this._mousemoveHandler);
  }

  _resetFrameSlides() {
        // hide everything out of selector's boundaries
    this._selector.style.overflow = 'hidden';
    this._selector.style.textAlign = 'center';

        // Create frame and apply styling
    this._sliderFrame = document.createElement('div');
    this._sliderFrame.style.width = 'auto';
    this._sliderFrame.style.display = 'inline-flex';

    this._setTransition(this._config.duration, this._config.easing);
    this._setTranslation(0);

    if (this._config.draggable) {
      this._setCursor(Siema.GRAB_CURSOR);
    }

    this._innerSlides = this._innerElements.map(element => {
      const elementContainer = document.createElement('div');
      elementContainer.classList.add('siema-slide');
      elementContainer.style.flex = '0 0 auto';
      elementContainer.style.width = 'auto';
      elementContainer.appendChild(element);
      return elementContainer;
    });

    this._innerSlides.forEach(slide => this._sliderFrame.appendChild(slide));

        // Clear selector (just in case something is there) and insert a frame
    this._selector.innerHTML = '';
    this._selector.appendChild(this._sliderFrame);
  }

    /**
     * Calculate the x translation value of a particular slide index
     */
  _calculateTranslation(index, stickToEdges = true) {
    const containerWidth = this._selector.getBoundingClientRect().width;
    const frameWidth = this._sliderFrame.getBoundingClientRect().width;
    const widths = this._innerSlides.map(el => el.getBoundingClientRect().width);
    const previousWidthSum = widths.slice(0, index).reduce((sum, width) => sum + width, 0);
    const translation = (containerWidth / 2) - previousWidthSum - (widths[index] / 2);
    const maxClamp = stickToEdges ? 0 : Infinity;
    const minClamp = stickToEdges ? Math.min(0, containerWidth - frameWidth) : -Infinity;
    return Siema.clamp(translation, minClamp, maxClamp);
  }

  _slideToCurrent() {
    this._slideToIndex(this._currentSlide);
  }

  _slideToIndex(index) {
    const translation = this._calculateTranslation(index, this._config.stickToEdges);
    this._setTranslation(translation);
  }

  _setTranslation(value) {
    this._sliderFrame.style[this._transformProperty] = Siema.translate(value);
    this._currentTranslation = value;
  }

  _setTransition(duration, easing) {
    this._sliderFrame.style[this._transitionProperty] = Siema.transition(duration, easing);
  }

  _setCursor(cursor) {
    this._selector.style.cursor = cursor;
  }

  _updateAfterDrag() {
        // Get the current translation value of the dragged frame
        // Get the translation values for each slide
        // Find the closest slide, move to that
    const translations = this._innerSlides.map((_, i) => this._calculateTranslation(i, false));
    const closestTranslation = Siema.closest(this._currentTranslation, translations);
    this._setCurrentSlide(translations.indexOf(closestTranslation));
    this._slideToCurrent();
  }

  _resizeHandler() {
    this._slideToCurrent();
  }

  _clearDrag() {
    this._drag = {
      startingTranslation: 0,
      startX: 0,
      endX: 0,
      startY: 0,
      letItGo: null
    };
  }

  _touchstartHandler(e) {
    e.stopPropagation();
    this._pointerDown = true;
    this._drag.startX = e.touches[0].pageX;
    this._drag.startY = e.touches[0].pageY;
  }

  _touchendHandler(e) {
    e.stopPropagation();
    this._pointerDown = false;
    if (this._drag.endX) {
      this._updateAfterDrag();
    }
    this._setTransition(this._config.duration, this._config.easing);
    this._clearDrag();
  }

  _touchmoveHandler(e) {
    e.stopPropagation();

    if (this._drag.letItGo === null) {
      this._drag.letItGo = Math.abs(this._drag.startY - e.touches[0].pageY) < Math.abs(this._drag.startX - e.touches[0].pageX);
    }

    if (this._pointerDown && this._drag.letItGo) {
            // e.preventDefault();
      this._drag.endX = e.touches[0].pageX;
      this._setTransition(0, this._config.easing);
      const translation = this._calculateTranslation(this._currentSlide, this._config.stickToEdges) - (this._drag.startX - this._drag.endX);
      this._setTranslation(translation);
    }
  }

  _mousedownHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    this._pointerDown = true;
    this._drag.startX = e.pageX;
    this._drag.startingTranslation = this._currentTranslation;
    this._setCursor(Siema.GRABBING_CURSOR);
  }

  _mouseupHandler(e) {
    e.stopPropagation();
    this._pointerDown = false;
    this._setCursor(Siema.GRAB_CURSOR);
    this._setTransition(this._config.duration, this._config.easing);
    this._updateAfterDrag();
    this._clearDrag();
  }

  _mousemoveHandler(e) {
    e.preventDefault();
    if (this._pointerDown) {
      this._drag.endX = e.pageX;
      const translation = this._drag.startingTranslation - (this._drag.startX - this._drag.endX);
      this._setTransition(0, this._config.easing);
      this._setTranslation(translation);
    }
  }

  _mouseleaveHandler(e) {
    if (this._pointerDown) {
      this._pointerDown = false;
      this._drag.endX = e.pageX;
      this._setCursor(Siema.GRAB_CURSOR);
      this._setTransition(this._config.duration, this._config.easing);
      this._updateAfterDrag();
      this._clearDrag();
    }
  }
}
