var _ = require('lodash');
var async = require('async');

module.exports = {
  construct: function(self, options) {
    if (!process.env.APOS_PROFILER) {
      // Not enabled
      self.apos.utils.debug('apostrophe-profiler: APOS_PROFILER environment variable not set, doing nothing.');
      return;
    }
    var flags = process.env.APOS_PROFILER.split(/,/);
    _.each(flags, function(flag) {
      var matches = flag.match(/^(.*?)\=(.*)$/);
      if (matches) {
        options[matches[1]] = matches[2];
      } else {
        options[flag] = true;
      }
    });
    if (options.cumulative && options['per-request']) {
      self.apos.utils.error('apostrophe-profiler: cumulative and per-request are mutually exclusive.');
      process.exit(1);
    }
    if (!(options.cumulative || options['per-request'])) {
      self.apos.utils.error('apostrophe-profiler: you must set APOS_PROFILER to either cumulative\nor per-request.');
      process.exit(1);
    }

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));
    require('./lib/widgets.js')(self, options);
    self.cumulative = {};
    debugReq(self.cumulative);
    if (options.cumulative) {
      self.apos.utils.debug('apostrophe-profiler: reporting cumulative tracked time every 10 seconds.\nFigures over 100% occur when nested actions also track time.\n');
      setInterval(function() {
        reqOutput(self.cumulative);
      }, 10000);
    }
    if (options['per-request']) {
      self.apos.utils.debug('apostrophe-profiler: reporting time for each request.\nFigures over 100% occur when nested actions also track time.\n');
      self.expressMiddleware = {
        when: 'beforeRequired',
        middleware: function(req, res, next) {
          if (options['per-request']) {
            debugReq(req);
            req.res.on('finish', function() {
              req.aposDebug.end = self.apos.utils.now();
              reqOutput(req);
            });
          }
          return next();
        }
      };
    }
    var superServeGetPage = self.apos.pages.serveGetPage;
    self.apos.pages.serveGetPage = function(req, callback) {
      var p = self.apos.utils.profile(req, 'serveGetPage');
      return superServeGetPage(req, function(err) {
        p();
        return callback(err);
      });
    }

    // Redefine callAll and callOne so that we can profile them heavily

    self.apos.callAll = function(name /* , arguments, ... callback */) {
      var req = arguments[1];
      if (!req.aposDebug) {
        return self.callAll.apply(self, arguments);
      }
      var args = Array.prototype.slice.call(arguments);
      var start = self.apos.utils.now();
      return self.callAll.apply(self, args);
    };

    /**
     * Allow to bind a callAll method for one module.
     */
    self.apos.callOne = function(moduleName, method, /* argument, ... */ callback) {
      var args = Array.prototype.slice.call(arguments);
      var extraArgs = args.slice(2, args.length - 1);
      callback = args[args.length - 1];
      return invoke(moduleName, method, extraArgs, callback);
    };

    // For every module, if the method `method` exists,
    // invoke it. The method may optionally take a callback.
    // The method must take exactly as many additional
    // arguments as are passed here between `method`
    // and the final `callback`.

    self.callAll = function(method, /* argument, ... */ callback) {
      var args = Array.prototype.slice.call(arguments);
      var extraArgs = args.slice(1, args.length - 1);
      callback = args[args.length - 1];
      return async.eachSeries(_.keys(self.apos.modules), function(name, callback) {
        return invoke(name, method, extraArgs, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    };

    // You may call with two arguments at the start of your operation
    // (returns a function you must call when the operation is over) or with three
    // at the end (supply your own duration in a single call).
    //
    // `req` may be null or entirely omitted.

    self.apos.utils.profile = function(req, key, duration) {
      if ((typeof req) === 'string') {
        if (arguments.length === 2) {
          return self.apos.utils.profile(null, arguments[0], arguments[1]);
        } else {
          return self.apos.utils.profile(null, arguments[0]);
        }
      }
      if (arguments.length === 3) {
        record(req, key, duration);
      } else {
        var start = self.apos.utils.now();
        return function() {
          record(req, key, self.apos.utils.now() - start);
        };
      }

      function record(req, key, n) {
        if (options['per-request']) {
          if (req && req.res) {
            // Great
          } else {
            req = self.cumulative;
          }
          if (req.res && (!req.aposDebug)) {
            req = self.cumulative;
          }
        } else if (options.cumulative) {
          req = self.cumulative;
          req.aposDebug.reported += n;
        }
        var subkeys = key.split(/\./);
        var subkey;
        var context = req.aposDebug.times;
        var i;
        for (i = 0; (i < subkeys.length); i++) {
          subkey = subkeys.slice(0, i + 1).join('.');
          context[subkey] = context[subkey] || 0;
          context[subkey] += n;
        }
      }
    };

    function debugReq(req) {
      req.aposDebug = {
        start: self.apos.utils.now(),
        times: {},
        reported: 0
      };
    };

    // Generic helper for call* methods
    function invoke(moduleName, method, extraArgs, callback) {
      var p = self.apos.utils.profile(extraArgs[0], 'callAll.' + method + '.' + moduleName);
      var module = self.apos.modules[moduleName];
      var invoke = module[method];

      return body(function(err) {
        p();
        return callback(err);
      });

      function body(callback) {
        if (invoke) {
          if (invoke.length === (1 + extraArgs.length)) {
            return invoke.apply(module, extraArgs.concat([callback]));
          } else if (invoke.length === extraArgs.length) {
            return setImmediate(function () {
              try {
                invoke.apply(module, extraArgs);
              } catch (e) {
                return callback(e);
              }
              return callback(null);
            });
          } else {
            return callback(moduleName + ' module: your ' + method + ' method must take ' + extraArgs.length + ' arguments, plus an optional callback.');
          }
        } else {
          return setImmediate(callback);
        }
      }

    }

    function reqOutput(req) {
      // Threshold percentage to be considered interesting (default: 1%)
      var threshold = options.threshold ? parseFloat(options.threshold) : 1;
      var total;
      if (req === self.cumulative) {
        total = req.aposDebug.reported;
      } else {
        total = req.aposDebug.end - req.aposDebug.start;
      }
      if (req !== self.cumulative) {
        self.apos.utils.debug('\nRequest: ' + req.url + '\n');
      }
      self.apos.utils.debug('Total time: ' + format(total));
      self.apos.utils.debug('\nItems taking over ' + threshold + '% of time\n');
      threshold = threshold / 100.0;
      var keys = _.keys(req.aposDebug.times);
      keys.sort(function(a, b) {
        if (req.aposDebug.times[a] > req.aposDebug.times[b]) {
          return -1;
        } else if (req.aposDebug.times[a] < req.aposDebug.times[b]) {
          return 1;
        } else {
          return 0;
        }
      });
      _.each(keys, function(key) {
        var v = req.aposDebug.times[key];
        if (v / total < threshold) {
          return;
        }
        self.apos.utils.debug(key + ': ' + format(v));
      });
    
      function format(n) {
        return decimal(n) + 'ms (' + decimal(n / total * 100) + '%)';
      }
    
      function decimal(n) {
        return Number.parseFloat(n).toFixed(2);
      }
        
    }
    
  }
};

