/**
 * videojs-time-offset
 * @version 0.2.2
 * @copyright 2016 Can Küçükyılmaz <can@vngrs.com>
 * @fixed: Plugin Issues 2017 Studio Berlin
 * @license MIT
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.videojsTimeOffset = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _videoJs = (typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null);

var _videoJs2 = _interopRequireDefault(_videoJs);

// Default options for the plugin.
var defaults = {
  start: 0,
  end: 0,
  page: 1,
  perPageInMinutes: 0,
  originalFallback: false
};

/**
 * for fixing buffer status overflow issue
 */
var addStyle = function addStyle() {
  /**
   * Style already included, only include once
   */
  if (document.getElementById('vjs-time-offset-style')) {
    return false;
  }

  var css = '\n    .vjs-time-offset .vjs-load-progress {\n       overflow: hidden;\n    };\n  ';
  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');

  style.id = 'vjs-time-offset-style';
  style.type = 'text/css';
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }

  head.appendChild(style);
};

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 * @param    {Object} [options={}]
 */
var onPlayerReady = function onPlayerReady(player, options) {
  var offsetStart = undefined;
  var offsetEnd = undefined;
  var computedDuration = undefined;
  var originalFallback = undefined;

  // trigger ended event only once
  var isEndedTriggered = false;

  /**
   * calc offsetStart and offsetEnd based on options
   * if page params is setted use page values, Otherwise use defaults
   * default perPageInMinutes based on minutes, convert to seconds
   */
  options.perPageInMinutes = options.perPageInMinutes * 60;

  // page is natural number convert it to integer
  options.page = options.page - 1;

  if (options.start > 0) {
    offsetStart = options.start;
  } else {
    offsetStart = options.page * options.perPageInMinutes;
  }

  if (options.end > 0) {
    offsetEnd = options.end;
  } else {
    offsetEnd = (options.page + 1) * options.perPageInMinutes;
  }

  computedDuration = offsetEnd - offsetStart;

  originalFallback = options.originalFallback;

  /**
   * For monkey patching take references of original methods
   * We will override original methods
   */
  // @fix: correct buffer calculation - https://github.com/dogusdigital/videojs-time-offset/issues/8 RIO
  var __monkey__ = {
    currentTime: player.currentTime,
    remainingTime: player.remainingTime,
    duration: player.duration,
    buffered: player.buffered 
  };

  player.addClass('vjs-time-offset');

  addStyle();

  player.updateTimeOffset = function(start, end) {
    offsetStart       = start;
    offsetEnd         = end;
    computedDuration  = offsetEnd - offsetStart;
  };

  // @fix: correct buffer calculation - https://github.com/dogusdigital/videojs-time-offset/issues/8 RIO
  player.buffered = function () {
    var buffered = __monkey__.buffered.call(player);
    return {
        buffered: buffered,
        length: buffered.length,
        start: function(i) { 
          var buf = buffered.start(i) - offsetStart;

          if (buf < 0)                buf = 0;
          if (buf > computedDuration) buf = computedDuration;

          return buf; 
        },
        
        end: function(i) { 
          var buf = buffered.end(i) - offsetStart;

          if (buf < 0)                buf = 0;
          if (buf > computedDuration) buf = computedDuration;

          return buf; 
        }
    };
  };

  player.remainingTime = function () {
    return player.duration() - player.currentTime();
  };

  player.duration = function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (offsetEnd > 0) {
      __monkey__.duration.apply(player, args);
      return computedDuration;
    }

    return __monkey__.duration.apply(player, args) - offsetStart;
  };

  player.originalDuration = function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return __monkey__.duration.apply(player, args);
  };

  player.currentTime = function (seconds) {
    if (typeof seconds !== 'undefined') {
      seconds = seconds + offsetStart;

      return __monkey__.currentTime.call(player, seconds);
    }

    var current = __monkey__.currentTime.call(player) - offsetStart;

    // @fix: currentTime - exact startframe - https://github.com/dogusdigital/videojs-time-offset/issues/9 RIO
    // @fix: currentTime - exact endframe   - https://github.com/dogusdigital/videojs-time-offset/issues/6 RIO
    if (current >= 0 && current > computedDuration) {
      player.currentTime(computedDuration);
      current = computedDuration;

      player.pause();
      if (!isEndedTriggered) {
        // @fix - double triggering - https://github.com/dogusdigital/videojs-time-offset/issues/10 RIO
        player.trigger('endedoffset');
        isEndedTriggered = true;
      }
    }

    return current;
  };

  /**
   * When user clicks play button after partition finished
   * start from beginning of partition
   */
  player.on('play', function () {
    var remaining = player.remainingTime();

    if (remaining <= 0) {
      player.currentTime(0);
      player.play();
    }
  });

  player.on('loadedmetadata', function () {
    var current = player.currentTime();
    var originalDuration = player.originalDuration();
    var invalidDuration = false;

    isEndedTriggered = false;

    // @fix: original duration fallback - https://github.com/dogusdigital/videojs-time-offset/issues/11 RIO

    // if setted end value isn't correct, Fix IT
    // it shouldn't be bigger than video length
    // added 0.03 (<1 frame) THRESHOLD because of inaccurate
    if (offsetEnd-0.03 > originalDuration) {
      if (originalFallback) computedDuration = originalDuration - offsetStart;
      invalidDuration = true;
    }

    // if setted start value isn't correct, Fix IT
    // it shouldn't be bigger than video length
    // added 0.001 THRESHOLD because of inaccurate
    if (offsetStart-0.001 > originalDuration) {
      if (originalFallback) {
        offsetStart = 0;
        computedDuration = originalDuration;
      }
      invalidDuration = true;
    }

    // trigger invalidDuration event
    if (invalidDuration) player.trigger('invalidDuration');

    if (current < 0) {
      player.currentTime(0);
    }
  });

  player.on('timeupdate', function () {
    var remaining = player.remainingTime();
    // added 0.001 THRESHOLD because of inaccurate
    if (remaining <= 0.001) {
      player.pause();
      if (!isEndedTriggered) {
        // @fix - double triggering - https://github.com/dogusdigital/videojs-time-offset/issues/10 RIO
        player.trigger('endedoffset');
        isEndedTriggered = true;
      }
    }
  });
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function time-offset
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
var timeOffset = function timeOffset(options) {
  var _this = this;

  this.ready(function () {
    onPlayerReady(_this, _videoJs2['default'].obj.merge(defaults, options));  // @fix: videojs 8.0 warn RIO
  });
};

// Register the plugin with video.js.
_videoJs2['default'].registerPlugin('timeOffset', timeOffset);  // @fix: videojs 8.0 warn RIO

// Include the version number.
timeOffset.VERSION = '0.2.2';

exports['default'] = timeOffset;
module.exports = exports['default'];
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])(1)
});