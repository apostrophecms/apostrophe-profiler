var _ = require('lodash');

module.exports = {
  beforeConstruct: function(self, options) {
    if (options.depth === undefined) {
      options.depth = 20;
    }
  },
  construct: function(self, options) {
    self.state.stackTrace = (new Error()).stack;
    self.state.cursorType = self.__meta.name;
    var superFinalize = self.finalize;
    self.finalize = function(callback) {
      return superFinalize(function(err) {
        if (err) {
          return callback(err);
        }
        var req = self.get('req');
        if (req.res.on) {
          if (!req.queries) {
            req.queries = [];
            req.res.on('finish', _.partial(self.outputQueries, req));
          }
          req.queries.push(_.omit(self.state, 'req'));
        }
        return callback(null);
      });
    };
    var superHandleFindArguments = self.handleFindArguments;
    self.handleFindArguments = function() {
      superHandleFindArguments();
      self.set('originalCriteria', self.get('criteria'));
    };

    self.outputQueries = function(req) {
      console.log('******** QUERIES FOR ' + req.url);
      _.each(req.queries, function(query) {
        self.outputQuery(query);
      });
      console.log('total: ' + req.queries.length);
    };

    self.outputQuery = function(query) {
      console.log('**** Cursor Type:');
      console.log(query.cursorType);
      console.log('Query State:');
      console.log(require('util').inspect(_.omit(query, 'stackTrace'), { depth: self.options.depth }));
      console.log('Stack Trace at Creation Time:');
      console.log(query.stackTrace.replace(/Error\n/, ''));
    };
  }
};
