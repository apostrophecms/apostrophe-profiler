var _ = require('lodash');

module.exports = {
  construct: function(self, options) {
    // bc
    if (!process.env['WIDGET_TIMES']) {
      if (process.env['WIDGET_LOAD_TIMES']) {
        process.env['WIDGET_TIMES'] = process.env['WIDGET_LOAD_TIMES'];
      }
    }
    // To avoid confusing people already using the module before it required options to
    // actually output anything
    var envs = [
      'QUERIES', 'TOTAL_QUERIES', 'QUERY_TYPES', 'WIDGET_TIMES'
    ];
    if (!_.find(envs, function(env) {
      return process.env[env];
    })) {
      // No arguments = no profiling
      return;
    }
    if (process.env['QUERIES'] || process.env['TOTAL_QUERIES'] || process.env['QUERY_TYPES']) {
      self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));
    }
    if (process.env['WIDGET_TIMES']) {
      require('./lib/widgets.js')(self, options);
    }
  }
};
