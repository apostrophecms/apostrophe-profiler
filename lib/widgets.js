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
        var end = now();
        if (!req.debugWidgets) {
          req.debugWidgets = {};
          if (req.res && req.res.on) {
            req.res.on('finish', _.partial(self.outputWidgets, req));
          }
        }
        if (!req.debugWidgets[name]) {
          req.debugWidgets[name] = { time: 0, invocations: 0 };
        }
        req.debugWidgets[name].invocations++;
        req.debugWidgets[name].time += (end - start);
        return callback(err);
      });
    };
  });
  self.outputWidgets = function(req) {
    console.log('******** WIDGET LOAD TIMES BY TYPE FOR ' + req.url);
    _.each(req.debugWidgets || {}, function(info, name) {
      console.log(name + ': ' + info.time + ' (' + info.invocations + ')');
    });
  };
};
