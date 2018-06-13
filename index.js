var _ = require('lodash');
var now = require('performance-now');

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
      'QUERIES', 'TOTAL_QUERIES', 'QUERY_TYPES', 'WIDGET_TIMES', 'REQUEST_TIMES'
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
      setInterval(function() {
        self.outputWidgets();
      }, 10000);
    }
    if (process.env['REQUEST_TIMES']) {
      self.expressMiddleware = {
        when: 'beforeRequired',
        middleware: function(req, res, next) {
          req.aposDebug = {
            times: {
              start: now(),
              callAllStart: {},
              callAllEnd: {}
            }
          };
          req.res.on('finish', function() {
            req.aposDebug.times.end = now();
            console.log(req.url + ': before serveGetPage: ' + format(req.aposDebug.times.serveGetPage - req.aposDebug.times.start));
            console.log(req.url + ': after serveGetPage: ' + format(req.aposDebug.times.afterServeGetPage - req.aposDebug.times.start));
            _.each(_.keys(req.aposDebug.times.callAllStart), function(key) {
              console.log(req.url + ': before ' + key + ': ' + format(req.aposDebug.times.callAllStart[key] - req.aposDebug.times.start));
              console.log(req.url + ': after ' + key + ': ' + format(req.aposDebug.times.callAllEnd[key] - req.aposDebug.times.start));
            });
          });
          return next();
        }
      };
      var superServeGetPage = self.apos.pages.serveGetPage;
      self.apos.pages.serveGetPage = function(req, callback) {
        req.aposDebug.times.serveGetPage = now();
        return superServeGetPage(req, function(err) {
          req.aposDebug.times.afterServeGetPage = now();
          return callback(err);
        });
      }
      var superCallAll = self.apos.callAll;
      self.apos.callAll = function(name /* , arguments, ... callback */) {
        var req = arguments[1];
        if (!req.aposDebug) {
          return superCallAll.apply(self.apos, arguments);
        }
        var args = Array.prototype.slice.call(arguments);
        req.aposDebug.times.callAllStart[name] = now();
        var callback = args[args.length - 1];
        args[args.length - 1] = function(err) {
          req.aposDebug.times.callAllEnd[name] = now();
          return callback(err);
        };
        return superCallAll.apply(self.apos, args);
      };
    }
  }
};

function format(n) {
  return Number.parseFloat(n).toFixed(2);
}
