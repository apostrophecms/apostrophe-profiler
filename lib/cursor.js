var _ = require('lodash');
var Promise = require('bluebird');

module.exports = {
  beforeConstruct: function(self, options) {
    if (options.depth === undefined) {
      options.depth = 20;
    }
  },
  construct: function(self, options) {
    var start = self.apos.utils.now();
    var superAfter = self.after;
    self.after = function(results, callback) {
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)(results);
      }
      function body(callback) {
        var after = self.apos.utils.now();
        self.apos.utils.profile(self.get('req'), 'cursor.' + self.__meta.name + '.main', after - start);
        return superAfter(results, function(err, results) {
          self.apos.utils.profile(self.get('req'), 'cursor.' + self.__meta.name + '.after', self.apos.utils.now() - after);
          return callback(err, results);
        });
      }
    };

  }
};
