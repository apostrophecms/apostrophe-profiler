var _ = require('lodash');

module.exports = {

  construct: function(self, options) {

    var profiler = self.apos.modules['apostrophe-profiler'];

    var superLowLevelMongoCursor = self.lowLevelMongoCursor;
    self.lowLevelMongoCursor = function(req, criteria, projection, options) {
      self.profilerSuggestIndex(criteria, options.sort);
      return superLowLevelMongoCursor(req, criteria, projection, options);
    };

    self.profilerSuggestIndex = function(criteria, sort) {
      var keys = self.profilerGetKeys(criteria);
      if (sort) {
        // Sorts should appear last in indexes
        _.each(sort, function(val, key) {
          keys.push({
            key: key,
            direction: val,
            rank: 3
          });
        });
      }
      keys.sort(function(a, b) {
        if (a.rank < b.rank) {
          return -1;
        } else if (a.rank > b.rank) {
          return 1;
        } else {
          if (a.key < b.key) {
            return -1;
          } else if (a.key > b.key) {
            return 1;
          } else {
            return 0;
          }
        }
      });
      var index = {};
      var seen = {};

      // Equality tests on certain properties mean we will
      // always use an existing index efficiently

      if (_.find(keys, { key: '_id', rank: 1 })) {
        return;
      }
      if (_.find(keys, { key: 'historicUrls', rank: 1 })) {
        return;
      }
      var workflow = self.apos.modules['apostrophe-workflow'];
      if (workflow) {
        if ((_.find(keys, { key: 'slug', rank: 1 })) &&
          (_.find(keys, { key: 'workflowLocale', rank: 1 }))) {
          return;
        }
        if ((_.find(keys, { key: 'workflowGuid', rank: 1 })) &&
          (_.find(keys, { key: 'workflowLocale', rank: 1 }))) {
          return;
        }
      } else {
        if (_.find(keys, { key: 'slug', rank: 1 })) {
          return;
        }
      }

      _.each(keys, function(key) {
        if (seen[key.key + ':' + key.direction]) {
          return;
        }
        index[key.key] = key.direction || 1;
        seen[key.key + ':' + key.direction] = true;
      });
      index = JSON.stringify(index);
      profiler.indexSuggestions = profiler.indexSuggestions || {};
      var suggestions = profiler.indexSuggestions;
      if (!_.has(suggestions, index)) {
        suggestions[index] = 0;
      }

      suggestions[index]++;
      if (!profiler.indexSuggestionsTimeout) {
        profiler.indexSuggestionsTimeout = setTimeout(function() {
          var indexes = _.keys(suggestions);
          indexes.sort(function(a, b) {
            if (suggestions[a] < suggestions[b]) {
              return 1;
            } else if (suggestions[a] > suggestions[b]) {
              return -1;
            } else if (a < b) {
              return -1;
            } else if (a > b) {
              return 1;
            } else {
              return 0;
            }
          });
          if (indexes.length) {
            self.apos.utils.log('\nSUGGESTED INDEXES, by frequency of use:\n');
            _.map(indexes, function(index) {
              self.apos.utils.log(index + ': ' + suggestions[index]);
            });
            self.apos.utils.log('\nWhen interpreting this report, you must take into account your own knowledge.\n');
            self.apos.utils.log('If you have equality tests on fields with values that are unique or');
            self.apos.utils.log('near-unique, you probably do not need to add a composite index,');
            self.apos.utils.log('especially not one featuring sort fields. Just add an index on');
            self.apos.utils.log('the near-unique field, or that plus workflowLocale if using');
            self.apos.utils.log('apostrophe-workflow. You may already have indexes that match these');
            self.apos.utils.log('or offer equivalent performance gains.');
          }
          profiler.indexSuggestionsTimeout = null;
        }, 5000);
      }
    };


    // Given a criteria object, return a flat array of properties
    // that it references, for insight into what properties might
    // make sense to index together in a composite index. Each
    // property is represented as an object with key, rank and
    // sometimes direction properties. Rank will be lower if
    // the key should come earlier in a composite index.

    self.profilerGetKeys = function(criteria) {
      var keys = [];
      _.each(criteria, function(val, key) {
        if ((key === '$and') || (key === '$or')) {
          keys = keys.concat(_.flatten(_.map(val, self.profilerGetKeys)));
        } else {
          // For most sites, the vast majority of content has the
          // same settings for these three keys, and so it is not
          // efficient to waste index space on them
          if ((key === 'loginRequired') || (key === 'published') || (key === 'trash')) {
            return;
          }
          if ((typeof val) !== 'object') {
            // equality test for sure
            rank = 1;
          } else if (val === null) {
            rank = 1;
          } else if (val.$in || val.$nin) {
            rank = 1;
          } else if (val.$lt || val.$lte || val.$gt || val.$gte) {
            // Ranges rank after equality checks
            rank = 2;
          } else {
            // regular expressions and other corner cases
            rank = 1;
          }
          keys.push({ key: key, rank: rank });
        }
      });
      return keys;
    };    
  }
};
