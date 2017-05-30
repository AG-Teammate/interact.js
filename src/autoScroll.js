const raf            = require('./utils/raf');
const getWindow      = require('./utils/window').getWindow;
const is             = require('./utils/is');
const domUtils       = require('./utils/domUtils');
const Interaction    = require('./Interaction');
const defaultOptions = require('./defaultOptions');

const autoScroll = {
  defaults: {
    enabled  : false,
    container: null,     // the item that is scrolled (Window or HTMLElement)
    margin   : 60,
    speed    : 300,      // the scroll speed in pixels per second
  },

  interaction: null,
  i: null,    // the handle returned by window.setInterval
  x: 0, y: 0, // Direction each pulse is to scroll in

  isScrolling: false,
  prevTime: 0,

  parentIframePageInfo: null, //Property to handle page info of parent iframe (iFrameResizer)

  start: function (interaction) {
    autoScroll.isScrolling = true;
    raf.cancel(autoScroll.i);

    autoScroll.interaction = interaction;
    autoScroll.prevTime = new Date().getTime();
    autoScroll.i = raf.request(autoScroll.scroll);
    if (typeof window !== undefined && window.parentIFrame) { //iFrameResizer
        window.parentIFrame.getPageInfo(function(pageInfo) {
            autoScroll.parentIframePageInfo = pageInfo;
        });
    }
  },

  stop: function () {
    autoScroll.isScrolling = false;
    raf.cancel(autoScroll.i);
    autoScroll.parentIframePageInfo = null; //iFrameResizer
  },

  // scroll the window by the values in scroll.x/y
  scroll: function () {
    const options = autoScroll.interaction.target.options[autoScroll.interaction.prepared.name].autoScroll;
    const container = options.container || getWindow(autoScroll.interaction.element);
    const now = new Date().getTime();
    // change in time in seconds
    const dt = (now - autoScroll.prevTime) / 1000;
    // displacement
    const s = options.speed * dt;

    if (s >= 1) {
      if (autoScroll.parentIframePageInfo && autoScroll.parentIframePageInfo.innerHeight) { //iFrameResizer
        autoScroll.parentIframePageInfo.scrollLeft += autoScroll.x * s;
        autoScroll.parentIframePageInfo.scrollTop += autoScroll.y * s;
          if (autoScroll.x != 0 || autoScroll.y != 0) {
            window.parentIFrame.scrollTo(autoScroll.parentIframePageInfo.scrollLeft,
             autoScroll.parentIframePageInfo.scrollTop);
          }
      }
      if (is.window(container)) {
        container.scrollBy(autoScroll.x * s, autoScroll.y * s);
      }
      else if (container) {
        container.scrollLeft += autoScroll.x * s;
        container.scrollTop  += autoScroll.y * s;
      }

      autoScroll.prevTime = now;
    }

    if (autoScroll.isScrolling) {
      raf.cancel(autoScroll.i);
      autoScroll.i = raf.request(autoScroll.scroll);
    }
  },
  check: function (interactable, actionName) {
    const options = interactable.options;

    return options[actionName].autoScroll && options[actionName].autoScroll.enabled;
  },
  onInteractionMove: function ({ interaction, pointer }) {
    if (!(interaction.interacting()
          && autoScroll.check(interaction.target, interaction.prepared.name))) {
      return;
    }

    if (interaction.simulation) {
      autoScroll.x = autoScroll.y = 0;
      return;
    }

    let top;
    let right;
    let bottom;
    let left;

    const options = interaction.target.options[interaction.prepared.name].autoScroll;
    const container = options.container || getWindow(interaction.element);

    if (autoScroll.parentIframePageInfo && autoScroll.parentIframePageInfo.innerHeight) { //iFrameResizer
        //calculate real pointer coordinates on the screen
        let screenX = pointer.clientX -
            autoScroll.parentIframePageInfo.scrollLeft +
            autoScroll.parentIframePageInfo.offsetLeft;
        let screenY = pointer.clientY -
            autoScroll.parentIframePageInfo.scrollTop +
            autoScroll.parentIframePageInfo.offsetTop;

        left = screenX < autoScroll.margin;
        top = screenY < autoScroll.margin;
        right = screenX > autoScroll.parentIframePageInfo.innerWidth - autoScroll.margin;
        bottom = screenY > autoScroll.parentIframePageInfo.innerHeight - autoScroll.margin;
    }
    else if (is.window(container)) {
      left   = pointer.clientX < autoScroll.margin;
      top    = pointer.clientY < autoScroll.margin;
      right  = pointer.clientX > container.innerWidth  - autoScroll.margin;
      bottom = pointer.clientY > container.innerHeight - autoScroll.margin;
    }
    else {
      const rect = domUtils.getElementClientRect(container);

      left   = pointer.clientX < rect.left   + autoScroll.margin;
      top    = pointer.clientY < rect.top    + autoScroll.margin;
      right  = pointer.clientX > rect.right  - autoScroll.margin;
      bottom = pointer.clientY > rect.bottom - autoScroll.margin;
    }

    autoScroll.x = (right ? 1: left? -1: 0);
    autoScroll.y = (bottom? 1:  top? -1: 0);

    if (!autoScroll.isScrolling) {
      // set the autoScroll properties to those of the target
      autoScroll.margin = options.margin;
      autoScroll.speed  = options.speed;

      autoScroll.start(interaction);
    }
  },
};

Interaction.signals.on('stop-active', function () {
  autoScroll.stop();
});

Interaction.signals.on('action-move', autoScroll.onInteractionMove);

defaultOptions.perAction.autoScroll = autoScroll.defaults;

module.exports = autoScroll;
