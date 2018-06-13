# apostrophe-debug

This module provides debugging conveniences for the [Apostrophe CMS](http://apostrophenow.org), version 2.x or better.

This module is currently alpha quality and undergoing rapid change. Since you're not going to use it in production and it doesn't modify your data, there isn't much cause for worry, but expect to be checking this README often as we add and change the functionality.

## Installation

Edit your `package.json` file. Add `apostrophe-debug` to your dependencies:

```
'apostrophe-debug': 'apostrophecms/apostrophe-debug'
```

Run `npm install`.

Now turn it on in your project:

```javascript
// in data/local.js, not app.js

module.exports = {
  modules: {
    apostrophe-debug: {}
  }
};
```

> Anything in your `data/local.js` file merges with the configuration object in `app.js`, and our standard deployment recipes *do not* deploy this file. That's why it's the logical place to turn on debugging features in a dev environment.

## Debugging cursors, finding wasted queries, spotting slow widgets

You'll need to set environment variables when launching your site. An example:

```
QUERIES=1 node app
```

This example prints the elapsed time in milliseconds for each Apostrophe cursor query made in each request and what kind of Apostrophe cursor it came from, sorted in descending order by time consumed. You will also get information about the time spent in the stages of each query.

```
QUERIES=1 QUERY_CRITERIA=1 node app
```

Print the above, plus the MongoDB criteria for each query.

```
TOTAL_QUERIES=1 node app
```

Total time spent in cursor queries only.

```
WIDGET_TIMES=1 node app
```

Print the time spent loading and rendering each type of widget during the request. Also prints the cumulative time for each widget type every 10 seconds, which is often more useful for studying performance under load.

If you set nothing, no profiling occurs and no output is generated.

We have used these features to track down and eliminate redundant queries and to develop ideas for further query optimization.

## Changelog

2018-06-13: new functionality for debugging query performance.

2018-06-05: environment variables rather than command line arguments. Easier to add to existing setups.

2017-03-08: command line arguments are now necessary to get any output. If you do not pass them, no profiling occurs.

