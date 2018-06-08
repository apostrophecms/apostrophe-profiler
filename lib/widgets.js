var _ = require('lodash');
var now = require('performance-now');

module.exports = function(self, options) {
  // Monkeypatch the widget managers to report load times. TODO: work on doing this
  // via "improve" in a way that isn't too annoying to work with so it's clean. -Tom
  var widgetManagers = self.apos.areas.widgetManagers;
  _.each(widgetManagers, function(manager, name) {
    var superLoad = manager.load;
    manager.load = function(req, widgets, callback) {
      var start = now();
      return superLoad(req, widgets, function(err) {
        timeSince(req, start, 'load');
        return callback(err);
      });
    };
    var superOutput = manager.output;
    manager.output = function(widget, options) {
      var start = now();
      var result = superOutput(widget, options);
      timeSince(self.apos.templates.contextReq, start, 'output');
      return result;
    };
    function timeSince(req, start, category) {
      var end = now();
      if (!req.debugWidgets) {
        req.debugWidgets = {};
        if (req.res && req.res.on) {
          req.res.on('finish', _.partial(self.outputWidgets, req));
        }
      }
      if (!req.debugWidgets[name]) {
        req.debugWidgets[name] = { invocations: 0, time: 0 };
      }
      if (!req.debugWidgets[name][category]) {
        req.debugWidgets[name][category] = 0;
      }
      req.debugWidgets[name].invocations++;
      req.debugWidgets[name].time += (end - start);
      req.debugWidgets[name][category] += (end - start);
    }
  });
  self.outputWidgets = function(req) {
    if (process.env['WIDGET_TIMES']) {
      console.log('******** WIDGET TIMES BY TYPE FOR ' + req.url);
      var keys = _.keys(req.debugWidgets);
      keys.sort(function(a, b) {
        if (req.debugWidgets[a].time > req.debugWidgets[b].time) {
          return -1;
        } else if (req.debugWidgets[b].time > req.debugWidgets[a].time) {
          return 1;
        } else {
          return 0;
        }
      });
      _.each(keys, function(name) {
        var info = req.debugWidgets[name];
        console.log(name + ': ' + round(info.time) + ' (' + info.invocations + ')' + ' load: ' + round(info.load) + ' output: ' + round(info.output));
      });
      function round(n) {
        if (!n) {
          return 0;
        }
        return Math.round(n * 100) / 100;
      }
    }
  };
};
