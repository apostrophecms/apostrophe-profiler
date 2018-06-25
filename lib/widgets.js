var _ = require('lodash');

module.exports = function(self, options) {
  // Monkeypatch the widget managers to report load times. TODO: work on doing this
  // via "improve" in a way that isn't too annoying to work with so it's clean. -Tom
  var widgetManagers = self.apos.areas.widgetManagers;
  _.each(widgetManagers, function(manager, name) {
    var superLoad = manager.load;
    manager.load = function(req, widgets, callback) {
      var start = self.apos.utils.now();
      return superLoad(req, widgets, function(err) {
        timeSince(req, start, 'load');
        return callback(err);
      });
    };
    var superOutput = manager.output;
    manager.output = function(widget, options) {
      var start = self.apos.utils.now();
      var result = superOutput(widget, options);
      timeSince(self.apos.templates.contextReq, start, 'output');
      return result;
    };
    function timeSince(req, start, category) {
      var end = self.apos.utils.now();
      self.apos.utils.profile(req, 'widget.' + name + '.' + category, end - start);
    }
  });
};
