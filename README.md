# apostrophe-profiler

This module finds slow code. It provides performance profiling for the [Apostrophe CMS](http://apostrophenow.org), version 2.x or better.

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
```

If you prefer, you can get cumulative figures every 10 seconds. This is
useful when testing heavy loads, and also includes figures for
activity that did not take place inside a web request:

```
APOS_PROFILER=cumulative node app
```

By default, activities that consumed less than 1% of the time
are not shown. You can change this figure, for instance
to 2%:

```
APOS_PROFILER=cumulative,threshold=2 node app
```

## "How come the numbers don't add up to 100%?"

Many categories overlap. Time spent in cursors is also part of the
time spent in various `callAll` methods like `pageBeforeSend`.
The same goes for widgets and cursors. 

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

## "Great, but how do I make my code faster?"

A few tips to get you started:

* Always set projections with your joins, or `areas: false, joins: false`.
* Don't hit third-party web APIs on every request. Always cache those results.
* Don't hit third-party APIs at all when building the page, if you can
avoid it. Instead, hit them via AJAX requests after the page loads.
* Use the `apostrophe-global` module wisely. Don't fill it with joins,
especially to things you don't need on every single request. *Do*
use it to directly hold things you would otherwise join with but need
on every request.

## Changelog

2018-06-15: API-stable 2.0.0 release.

2018-06-13: new functionality for debugging query performance.

2018-06-05: environment variables rather than command line arguments. Easier to add to existing setups.

2017-03-08: command line arguments are now necessary to get any output. If you do not pass them, no profiling occurs.

