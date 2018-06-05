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

You'll need to set environment variables when launching your site:

```
QUERIES=1 TOTAL_QUERIES=1 WIDGET_TIMES=1 QUERY_TYPES=1 node app
```

You may of course omit any or all of these.

If you set `QUERIES`, after each web request, this module logs a list of all [Apostrophe cursors](http://apostrophenow.org/tutorials/intermediate/cursors.html) just before actual MongoDB queries take place, including the state of all of their filters, the query criteria object, and a stack trace showing where the cursor was created.

If you set just `TOTAL_QUERIES`, you just get a total number of queries made by each request, which is handy for checking your optimizations as you go.

If you set `WIDGET_TIMES`, you get total time information for all widget types loaded in the request. This includes both time spent in the `load` method to asynchronously load resources (such as joins) and time spent in the `output` method to render the widget in the page.

If you set nothing, no profiling occurs and no output is generated.

We have used these features to track down and eliminate redundant queries and to develop ideas for further query optimization.

## Changelog

2018-06-05: environment variables rather than command line arguments. Easier to add to existing setups.

2017-03-08: command line arguments are now necessary to get any output. If you do not pass them, no profiling occurs.

