/*!
 * HeliLens - Viewer v0.1
 * http://www.helilens.com/
 *
 * Copyright 2014, Thomas Baker
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * *
 * Date: Mar 10 10:25:12 2015
 */
;(function($, window, document, undefined) {


"use strict";

  var defaultConfig = {
    'reverseFrames': true,
    'enableDebug': false,
    'framesOffset': 100,
    'framesCount': 0
  };

  function player(config) {

    this.config = $.extend({}, defaultConfig, config);

    this.framesWidth = 799;

    this.loadedFrames = [];

    this.inertiaOn = false;
    this.inertiaSpeed = 2;
    this.currentPosition = 0;
    this.previousFrame = 0;
    this.mouseSpeedPosition = 0;
    this.mouseSpeedTime = 0;
    this.mouseSpeedValue = 0;

    this.debug = [];
    this.framesContainer = $(".fc");

    var isTouchDevice = 'ontouchstart' in document.documentElement;
    if (!isTouchDevice) $(".cc").show();

  }

  player.prototype = {
    start: function() {
      NProgress.settings.speed = 0;
      NProgress.start();

      var self = this;

      this.slider = $(".s").slider({
        min: 1,
        max: 1000,
        value: 500,
        slide: function(event, ui) {
          self.setFrameFromSlider(ui.value);
          self.updateSpeed(ui.value);
        },
        start: function() {
          self.stopInertia();
        },
        stop: function() {
          self.startInertia();
        }
      });

      for (var x = 0; x < this.config['framesCount']; x++) {
        var i = x + this.config['framesOffset'];
        if (i >= this.config['framesCount']) i -= this.config['framesCount'];

        this.framesContainer.append("<img id='f-" + x + "' class='f' src='//s3-ap-southeast-2.amazonaws.com/helilens-sets/" + sceneKey + "_" + i + ".jpg' data-index='" + x + "' />");
      }

      $(".f").on("load", function(e) {
        self.frameLoaded(e.target.attributes["data-index"].value);
      });

      setInterval(function() {
        if (!self.inertiaOn)
          return;

        var newPosition = self.slider.slider("value") + self.inertiaSpeed;

        self.setFrameFromSlider(newPosition);
      }, 35);

      var previousTouchPosition = -1;
      $(".fc").on("touchend", function(e) {
        previousTouchPosition = -1;
        self.startInertia();
      });

      $(".fc").on("touchmove", function(e) {
        e.preventDefault();
        var pageX = e.originalEvent.touches[0].pageX;
        if (pageX == 0)
          return;

        self.stopInertia();
        var touchPosition = ((pageX) / self.framesWidth) * 1000;

        self.updateSpeed(touchPosition);

        self.refreshDebug("Touch Position", touchPosition);

        if (touchPosition < 0)
          touchPosition = 0;
        if (touchPosition > 1000)
          touchPosition = 1000;

        if (previousTouchPosition == -1)
          previousTouchPosition = touchPosition;

        var change = touchPosition - previousTouchPosition;

        self.setFrameFromSlider(self.currentPosition + change);

        previousTouchPosition = touchPosition;
      });

      $(window).on("resize", function() {
        self.windowResize();
      });

      self.windowResize();
    },
    windowResize: function() {
      this.framesWidth = window.innerWidth;
      this.refreshDebug("Frames Width", this.framesWidth);
    },
    setFrameFromSlider: function(sliderPosition) {
      if (this.loadedFrames.length < this.config['framesCount'])
        return;

      if (sliderPosition > 1000)
        sliderPosition -= 1000;
      if (sliderPosition < 1)
        sliderPosition += 1000;

      this.slider.slider("value", sliderPosition);
      this.currentPosition = sliderPosition;

      if (this.config['reverseFrames']) {
        sliderPosition = 1000 - sliderPosition;
      }

      var frameIndex = Math.floor((sliderPosition / 1000) * (this.config['framesCount'] - 1));

      this.setFrame(frameIndex);
    },
    setFrame: function(frameIndex) {
      this.refreshDebug("Frame Index", frameIndex);

      var frameElementId = "#f-" + frameIndex;

      if (this.previousFrame != frameElementId) {
        $(frameElementId).css("display", "block");
        $(this.previousFrame).css("display", "");
        this.previousFrame = frameElementId;
      }
    },
    frameLoaded: function(frame) {
      this.loadedFrames.push(frame);
      this.loadedFrames.sort(function(a, b) {
        return a - b;
      });
      if (this.loadedFrames.length == 1) {
        this.setFrame(frame);
      }

      //console.log(frame);
      NProgress.set(this.loadedFrames.length / this.config['framesCount']);

      if (this.loadedFrames.length >= this.config['framesCount']) {
        NProgress.done(true);
        this.setFrameFromSlider(500);
      }

      this.refreshDebug("Frames Loaded", this.loadedFrames.length);
    },
    startInertia: function() {
      this.inertiaSpeed = (this.getSpeed() / 20);
      this.inertiaOn = true;
      this.mouseSpeedTime = 0;
    },
    stopInertia: function() {
      this.inertiaOn = false;
    },
    refreshDebug: function(key, value) {
      if (this.config['enableDebug']) {
        this.debug[key] = value;

        $("#d").html("").show();

        for (var d in this.debug) {
          $("#d").append(d + ": " + this.debug[d] + "<br/>");
        }
      }
    },
    updateSpeed: function(slidePosition) {
      var currentTime = new Date().getTime();

      var distance = slidePosition - this.mouseSpeedPosition;
      var time = currentTime - this.mouseSpeedTime;

      this.mouseSpeedTime = currentTime;
      this.mouseSpeedPosition = slidePosition;

      this.mouseSpeedValue = (distance / time) * 1000;

      this.refreshDebug("Mouse Speed", Math.floor(this.mouseSpeedValue));
    },
    getSpeed: function() {
      if ((new Date().getTime()) > this.mouseSpeedTime + 100)
        return 0;

      return this.mouseSpeedValue;
    }
  };

  window.HeliLensPlayer = player;

  var sceneKey = queryObj()['k'];
  var debug = queryObj()['d'] === "1";

  $.ajax({
    dataType: "json",
    url: "//s3-ap-southeast-2.amazonaws.com/helilens-sets/" + sceneKey + "_config.json",
    success: function(d) {
      var tplayer = new player(d);
      tplayer.config['enableDebug'] = debug;
      tplayer.start();
    },
    error: function(d) {
      if (d.status == 404 || d.status == 403) {
        $("#m").html("Sorry, we couldn't find the requested scene.");
      } else {
        $("#m").html(d.statusText);
      }
    }
  });

  function queryObj() {
    var result = {}, keyValuePairs = location.search.slice(1).split('&');

    keyValuePairs.forEach(function(keyValuePair) {
      keyValuePair = keyValuePair.split('=');
      result[keyValuePair[0]] = keyValuePair[1] || '';
    });

    return result;
  }
})(window.jQuery, window, document);