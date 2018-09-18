# apostrophe-profiler

This module finds slow code. It provides performance profiling for the [Apostrophe CMS](https://apostrophecms.org), version 2.x or better.

This module only examines performance on the server side (it helps you optimize Time to First Byte, or TTFB). For browser-side performance issues, make sure you have enabled `minify: true` for the `apostrophe-assets` module and use tools like Pagespeed to get more suggestions.

## Installation

Edit your `package.json` file. Add `apostrophe-profiler` to your dependencies:

```
'apostrophe-profiler': 'apostrophecms/apostrophe-profiler'
```

Run `npm install`.

Now turn it on in your project:

```javascript
// in data/local.js, not app.js

module.exports = {
  modules: {
    apostrophe-profiler: {}
  }
};
```

> Anything in your `data/local.js` file merges with the configuration object in `app.js`, and our standard deployment recipes *do not* deploy this file. That's why it's the logical place to turn on debugging features in a dev environment.

## Finding slow code

**By default, nothing happens.** Turn it on with an environment variable
when you test your app:

```
APOS_PROFILER=per-request node app
```

After each request, you'll see output like this:

```
Request: /

Total time: 294.52ms (100.00%)

Items taking over 1% of time

cursor: 256.82ms (87.20%)
cursor.apostrophe-pages-cursor: 137.28ms (46.61%)
cursor.apostrophe-pages-cursor.after: 109.96ms (37.34%)
cursor.apostrophe-global-cursor: 59.67ms (20.26%)
cursor.apostrophe-global-cursor.after: 56.59ms (19.21%)
serveGetPage: 46.35ms (15.74%)
cursor.apostrophe-pages-cursor.main: 27.32ms (9.27%)
widget: 24.16ms (8.20%)
cursor.apostrophe-images-cursor: 23.89ms (8.11%)
cursor.apostrophe-blog-cursor: 20.60ms (6.99%)
callAll: 18.91ms (6.42%)
callAll.pageBeforeSend: 18.09ms (6.14%)
cursor.apostrophe-images-cursor.main: 17.46ms (5.93%)
widget.apostrophe-images: 17.27ms (5.86%)
callAll.pageBeforeSend.apostrophe-pages: 16.53ms (5.61%)
cursor.apostrophe-blog-cursor.after: 14.08ms (4.78%)
widget.apostrophe-images.load: 12.04ms (4.09%)
cursor.apostrophe-events-cursor: 8.49ms (2.88%)
cursor.apostrophe-blog-cursor.main: 6.52ms (2.22%)
cursor.apostrophe-images-cursor.after: 6.43ms (2.18%)
cursor.apostrophe-events-cursor.main: 5.51ms (1.87%)
widget.apostrophe-images.output: 5.22ms (1.77%)
widget.apostrophe-files.load: 4.44ms (1.51%)
widget.apostrophe-files: 4.44ms (1.51%)
cursor.apostrophe-files-cursor: 3.27ms (1.11%)
cursor.apostrophe-global-cursor.main: 3.08ms (1.05%)
cursor.apostrophe-events-cursor.after: 2.98ms (1.01%)
```

If you prefer, you can get cumulative figures every 10 seconds. This is
useful when testing heavy loads, and also includes figures for
activity that did not take place inside a web request:

```
APOS_PROFILER=cumulative node app
```

> The cumulative view is usually best for simulating production loads as it smooths out differences between individual requests.

## Understanding the output

The output for time spent in widgets is worth discussing. Each widget's time is broken down into `load` time and `output` time. The `load` time is spent in `load` methods and may involve third-party APIs or just Apostrophe joins. The `output` time is spent in your Nunjucks templates and helper functions.

The output for time spent in cursors is interesting too. Time spent in `main` is usually attributable to the actual MongoDB query for that type of document. Time spent in `after` is usually attributable to joins, widget loaders for content in the document, and so on.

## Changing the threshold of "interesting" activity

By default, activities that consumed less than 1% of the time
are not shown. You can change this figure, for instance
to 2%:

```
APOS_PROFILER=cumulative,threshold=2 node app
```

## "How come the numbers don't add up to 100% and some exceed 100%?"

Many categories overlap. Time spent in cursors is also part of the
time spent in various `callAll` methods like `pageBeforeSend`.
The same goes for widgets and cursors. 

Also, cursors may invoke other cursors, which tracks the time in both places. Look at the `.main` portion to see what was done outside of `.after`, which carries out nested joins. This is why the overall figure for `cursors` can be misleading.

## Tracking time in your own code

The profiler already breaks down for you which widgets,
cursor types and `callAll` methods such as `pageBeforeSend`
took up the most time. You can also track time yourself,
like this:

```javascript
// Get a function to call after the action is complete
const p = self.apos.utils.profile(req, 'external-apis.twitter.list');
// Let's call a made-up Twitter API with a callback as an example
return twitter.getList(function(err, list) {
  // Tell the profiler the action is complete
  p();
  // Do something with err and list here
});
```

If you prefer you can report the time consumed yourself, in
milliseconds:

```javascript
self.apos.utils.profile(req, 'external-apis.twitter.list', 50);
```

Notice we pass `req` and a key identifying the action. If
there is no web request involved, you can omit `req` entirely
or pass `null`. The key is namespaced with `.` and the
most general category should come first, to add up all of the
time tracked in that category.

> It is safe to call this API even when this module is not installed. The `apostrophe` module ships with a stub version that does nothing so you can ship your own modules with profiling calls in place.

## Speeding up the database: `index-suggestions`

This module can also suggest additional MongoDB database indexes for your database. Apostrophe adds several "out of the box," but your project may have its own common queries that are sped up further by adding your own.

To activate this feature, use:

```
APOS_PROFILER=index-suggestions node app
```

A report will be printed every 5 seconds, assuming there have been new queries that result in new index suggestions.

### Interpreting index suggestions

*You have to apply your own knowledge when interpreting these suggestions.* For instance, the module might suggest this index:

```
{mySpecialSlug:1,updatedAt:-1}
```

But you know that `mySpecialSlug` has a unique or nearly unique value and that all of your queries are for a specific value of `mySpecialSlug`.

If so, you only need this index to speed them up:

```
{mySpecialSlug:1}
```

On the other hand, a suggestion like this, which you might see after looking at a "manage" view, may make a lot of sense:

```
{slug:1,type:1,updatedAt:-1}
```

Also, be aware that with the exception of a few standard indexes in Apostrophe, *this feature does not know what indexes you already have or how they might already be meeting the need.*

Finally, *remember that MongoDB limits you to 64 databases per collection*, and that more indexes mean more time and space consumed when inserting documents. Usually, for a CMS-driven website, this is fine because you are much more interested in read performance. But, do bear it in mind.

> This module only makes index suggestions based on queries that flow normally through Apostrophe's cursor APIs, such as typical page and piece loading queries. Direct MongoDB queries on the collection object are not analyzed.

### Adding an index

You can do this directly in the MongoDB shell:

```
db.aposDocs.ensureIndex({ slug: 1, type: 1, updatedAt: -1 })
```

You can also do it programmatically in any module. For instance:

```
// in lib/modules/my-module/index.js
module.exports = {
  afterConstruct: function(self, callback) {
    return self.addCustomIndex(callback);
  },
  construct: function(self, options) {
    self.addCustomIndex = function(callback) {
      return self.apos.docs.db.ensureIndex(
        { slug: 1, type: 1, updatedAt: -1 },
        callback
      );
    };
  }
};
```

For more information see the MongoDB documentation.

### Displaying the indexes you already have

One more MongoDB shell tip: you can list the indexes you already have, to make sure the one you are adding is not redundant or similar enough to be unnecessary.

```
db.aposDocs.getIndexes()
```

## "Great, but what else can I do to make my code faster?"

A few tips to get you started:

* Always set projections with your joins, or `areas: false, joins: false`.
* Don't hit third-party web APIs on every request. Always cache those results.
* Don't hit third-party APIs at all when building the page, if you can
avoid it. Instead, hit them via AJAX requests after the page loads.
* Use the `apostrophe-global` module wisely. Don't fill it with joins,
especially to things you don't need on every single request. *Do*
use it to directly hold things you would otherwise join with but need
on every request.
* Use the `index-suggestions` feature of this module, but remember that you must apply your own knowledge as well.


