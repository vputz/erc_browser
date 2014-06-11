
# An ERC Treemap Browser

The European Research Council supports top researchers around the
world, funding a number of projects that contribute greatly to our
scientific understanding of the world.  And happily, they make the
information about what they fund public; you can go straight to their
website at http://erc.europa.eu/projects-and-results and begin
browsing.

Unfortunately, this sort of browsing, while delightfully open, could do
a better job of letting a curious citizen see things from a top-down
view.  One can get a good understanding of a particular grant, but how
would one answer questions like

- How has funding changed across the years?
- Which countries are funded the most?
- How does funding compare across scientific domains?
- What projects contain summaries with the word 'quantum'?

This project represents one answer.  You can see the result at 
http://www.thingotron.com/erc_test/erc_treemap.html

## Part 1: Getting the Data

Enclosed is the dump_erc.js file, a Casper program used to walk the
various selections of the ERC website and download data.  This process
should absolutely not be used too often and is presented here mostly
as an example of "something that works"; I would love to see
government websites have their data available via XML SOAP or direct
download, but in the absence of this, scraping will have to do.  The
process takes some time and has several built-in delays to let the
webserver have a bit of a rest.  I acknowledge that taking this much
data from a website represents a fair load on its server and can only
justify it by saying that if we take a snapshot once, we can do a
great deal of analysis without bothering the server again.

The data is dumped in a simple JSON format representing an array of
items; each item is a dictionary with the various fields of the site
(project name, project acronym, funding, etc).  A CSV file would have
done just as well.

## Part 2: Rendering the Data

I use d3.js and heavily leverage Mike Bostock's 
["Zoomable Treemap" example](http://bost.ocks.org/mike/treemap/), but a
fixed zoomable treemap is only so useful.  I also use the NYT's 
[Pourover](http://nytimes.github.io/pourover) library for basic filtering.

### Filtering

First, Pourover is used to filter the existing data set using the
year/country/domain/category dropdown boxes on the left; to make
things more tidy, I used `bootstrap-multiselect` to hide all the
choices until in use, and to allow the "Domain" dropdown to have
descriptions which did not take up too much space when not in use.
The dropdown filters are created using Pourover's `makeExactFilter`,
using `underscore.js` to pluck unique values out of the list of data:


```javascript
    years = _.sortBy(_.uniq(_.pluck( arr, "call_year" )));
    yearFilter = PourOver.makeExactFilter( "call_year", years );
```

The substring filter is implemented by extending a basic filter to
cache results based on case-insensitive text search.  It's a bit of a
hack, but for a relatively small data set it works very well; search
for the line

```javascript
var SubstringFilter = PourOver.Filter.extend({
...
});
```

to see how it was done.

### Structuring

Next, the data is sorted into a tree by an ordered list of keys in
the `tree_from_array` function.

This allows the list of data to be grouped by keys into an arbitrary
ordering of the categorical keys year-category-domain-country; on the
left of the navigation is a list of those keys which use jquery's
`sortable` interface to be draggable in any order, and a `Stop
Breakdown` tile to halt the breakdown at that point (for example, if
you don't want to "drill" past `year`, you could drag `year` to the
top and then `Stop Breakdown`).

### Displaying

The bulk of the display is the treemap, which shows the existing level
and the basic structure of the next level down.  I supplemented that
with a series of bars on the right which help to visualize comparative
size of budget.  Once you drill down to the bottom level and are
examining individual grants, hovering over a block will show a summary
and clicking on the block will display the relevant data in the "Last
Selected Project Details" block on the bottom.

Hopefully this will be of use to those looking to render hierarchical
data in a flexible and reorderable manner.  Best of luck!
