var _ = require('lodash');
var now = require('performance-now');
var Promise = require('bluebird');

module.exports = {
  beforeConstruct: function(self, options) {
    if (options.depth === undefined) {
      options.depth = 20;
    }
  },
  construct: function(self, options) {
    self.state.debug = { 
      times: {
        construct: self.apos.utils.now()
      }
    };
    self.state.stackTrace = (new Error()).stack;
    self.state.cursorType = self.__meta.name;
    var superFinalize = self.finalize;
    self.finalize = function(callback) {
      self.state.debug.times.finalize = self.apos.utils.now();
      return superFinalize(function(err) {
        if (err) {
          return callback(err);
        }
        self.state.debug.times.afterFinalize = self.apos.utils.now();
        var req = self.get('req');
        if (req.res && req.res.on) {
          if (!req.debugQueries) {
            req.debugQueries = [];
            req.res.on('finish', _.partial(self.outputQueries, req));
          }
          req.debugQueries.push(_.omit(self.state, 'req'));
        }
        return callback(null);
      });
    };
    var superHandleFindArguments = self.handleFindArguments;
    self.handleFindArguments = function() {
      superHandleFindArguments();
      self.set('originalCriteria', self.get('criteria'));
    };

    var superAfter = self.after;
    self.after = function(results, callback) {
      self.state.debug.times.mongo = self.apos.utils.now();
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)(results);
      }

      function body(callback) {
        self.state.debug.times.after = self.apos.utils.now();
        self.apos.utils.profile(self.get('req'), 'cursor.' + self.__meta.name, self.state.debug.times.after - self.state.debug.times.construct);
          return superAfter(results, function(err) {
          return callback(err, results);
        });
      }
    };

    self.outputQueries = function(req) {
      if (process.env.QUERIES) {
        console.log('******** QUERIES FOR ' + req.url);
        var totalTime = 0;
        req.debugQueries.sort(function(a, b) {
          a = a.debug.times.after - a.debug.times.construct;
          b = b.debug.times.after - b.debug.times.construct;
          if (a > b) {
            return -1;
          } else if (a < b) {
            return 1;
          } else {
            return 0;
          }
        });
        _.each(req.debugQueries, function(query) {
          self.outputQuery(query);
          totalTime += (query.debug.times.after - query.debug.times.construct);
        });
        totals();
      } else if (process.env['QUERY_TYPES']) {
        _.each(req.debugQueries, function(query) {
          console.log(query.cursorType);
        });
      }
      if (process.env['TOTAL_QUERIES']) {
        totals();
      }
      function totals() {
        console.log('total time (queries): ' + format(totalTime) + ' (' + req.debugQueries.length + ')');
      }
    };

    self.outputQuery = function(query) {
      console.log(query.cursorType);
      if (process.env.QUERY_CRITERIA) {
        console.log(require('util').inspect(query.criteria, { depth: self.options.depth }));
      }
      if (process.env.QUERY_STATE) {
        console.log(require('util').inspect(_.omit(query, 'stackTrace'), { depth: self.options.depth }));
      }
      if (process.env.QUERY_STACK_TRACE) {
        console.log('Stack Trace at Creation Time:');
        console.log(query.stackTrace.replace(/Error\n/, ''));
      }
      console.log('Query execution time (all times cumulative):');
      console.log('To start of "finalize:" ' + format(query.debug.times.finalize - query.debug.times.construct));
      console.log('To end of "finalize:" ' + format(query.debug.times.afterFinalize - query.debug.times.construct));
      console.log('To end of mongo query: ' + format(query.debug.times.mongo - query.debug.times.construct));
      console.log('To end (including nested queries etc): ' + format(query.debug.times.after - query.debug.times.construct));
    };
  }
};

function format(n) {
  return Number.parseFloat(n).toFixed(2);
}
