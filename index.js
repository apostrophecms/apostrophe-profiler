module.exports = {
  construct: function(self, options) {
    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));
    require('./lib/widgets.js')(self, options);
  }
};
