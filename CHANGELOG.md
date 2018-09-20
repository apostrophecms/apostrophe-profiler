# Changelog

## 2.1.1

Minor tweaks to the `index-suggestions` output to take into account new information about situations that can confuse MongoDB into using a poorly chosen index. You will receive more suggestions than previously.

## 2.1.0

New `index-suggestions` feature for database query optimization when your database is large.

## Prehistory

2018-06-25: Stable 2.0.0 release.

2018-06-15: stabilized environment variable API.

2018-06-13: new functionality for debugging query performance.

2018-06-05: environment variables rather than command line arguments. Easier to add to existing setups.

2017-03-08: command line arguments are now necessary to get any output. If you do not pass them, no profiling occurs.

