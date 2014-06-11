var casper = require('casper').create({waitTimeout:30000});//{ verbose: true, logLevel: 'debug' }); //in create add { verbose:true, logLevel: 'debug'}

casper.start('http://erc.europa.eu/projects-and-results/erc-funded-projects', function() {
    this.echo("Beginning run");
});

var chooseCategory = function(category) {
    casper.then( function() {
	this.echo("Category " + category)
	this.fill('form#cordis-search-form', { funding_scheme : category } )
    })
    casper.wait( Math.random() * 3000 + 1 )
    casper.thenClick('input[type="submit"][id="edit-start-show"]' );
    casper.waitForSelector('img[src="/sites/all/modules/custom/cordis_search/misc/loading.gif"]', function () {});// this.echo("Loading appeared"); } );
    casper.waitWhileSelector('img[src="/sites/all/modules/custom/cordis_search/misc/loading.gif"]', function () {});// this.echo("Loading vanished"); });
    casper.waitForSelector('div#content-area')//, function () { this.echo("blorp"); } );
}


var utils = require('utils')
var x = require('casper').selectXPath;

var projectAttributes = function( c, attribute ) {
    var valuetext = ("alt_value_tag" in attribute) ? attribute.alt_value_tag : "value"
    var result = c.getElementsInfo(x("//div[@class='title'][(.='"+attribute.name+"')]/following-sibling::div[@class='"+valuetext+"']"));
    return result
}

var cheapAssert = function( condition ) {
    if (!condition) {
	throw "Failed Assertion"
    }
}

var allSameLength = function( arrays ) {
    var target = arrays[0].length;
    for( var i = 0; i < arrays.length; ++i ) {
	if (arrays[i].length !== target) {
	    return false;
	}
    }
    return true;
}

var eurosFromPrice = function(s) {
    var elements = s.split(" ")
    var factor = parseFloat(elements[0])
    var multiplier = 1.0
    switch( elements[1] ) {
    case "million" :
	multiplier = 1000000;
	break;
    default :
	throw ("Unknown multiplier " + elements[1] + " in " + s);
    }
    if ( elements[2] !== "Euros" ) {
	throw ("Unknown currency " + elements[2] + " in " + s);
    }
    return factor * multiplier
}

var institutionFromHI = function(s) {
    return(s.split(",").slice(0,-1).join(",").trim())
}

var countryFromHI = function(s) {
    return(s.split(",").slice(-1)[0].trim())
}

function callDomainFromString( s ) {
    if (s.length == 17) {
	return s.slice(14,17);
    } else {
	return s.slice(9,12);
    }
}

var entriesFromPage = function(c) {
    var result = [];
    
    var attributes = {}
    var attributeNames = [ 
	{ name : "Project", tag : "project", f : function(s) { return s.attributes.title } },
	{ name : "Project acronym", tag : "acronym" },
	{ name : "Researcher (PI)", tag : "pi" },
	{ name : "Host institution (HI)", tag : "hi", f : function(s) { return institutionFromHI(s.attributes.title)} },
	{ name : "Host institution (HI)", tag : "country", f : function(s) { return countryFromHI(s.attributes.title)} },
	{ name : "Call details", tag : "call_details", f : function(s) { return s.text.trim().slice(0,17).trim()} },
	{ name : "Call details", tag : "call_year", f : function(s) { return parseInt(s.text.trim().slice(4,8))} },
	{ name : "Call details", tag : "call_domain", f : function(s) { return callDomainFromString( s.text.trim().slice(0,17).trim() ) }},
	{ name : "Summary", tag : "summary", alt_value_tag : "value proejct_summary" },
	{ name : "Website (HI)", tag : "hi_website" },
	{ name : "Max ERC funding", tag : "erc_funding", f : function(s) { return eurosFromPrice(s.text.trim()) } },
	{ name : "Duration", tag : "duration" }

    ]

    for ( var i = 0; i < attributeNames.length; ++i ) {
	attributes[attributeNames[i].tag] = []
	var theseAttributes = projectAttributes( c, attributeNames[i] )
	for (var j = 0; j < theseAttributes.length; ++j ) {
	    //var thisAttribute = theseAttributes[j].text.trim();
	    var thisAttribute = ""
	    if ( attributeNames[i].f !== undefined ) {
		thisAttribute = attributeNames[i].f( theseAttributes[j] )
	    } else {
		thisAttribute = theseAttributes[j].text.trim();
	    }
	    attributes[ attributeNames[i].tag ].push( thisAttribute )
	}
    }
    //now check all the same length
    var attributeArrays = []
    for ( var prop in attributes ) {
	attributeArrays.push( attributes[prop] )
    }
    cheapAssert( allSameLength( attributeArrays ) )
    var numEntries = attributeArrays[0].length

    for ( var i = 0; i < numEntries; ++i ) {
	var entry = {}
	for ( var prop in attributes ) {
	    entry[prop] = attributes[prop][i]
	}
	result.push(entry);
    }

    return result
}

//why doesn't //text() work?
var total_results = function(c) {
    return parseInt(c.getElementInfo(x("//div[@class='title'][(.='Total results:')]/..")).text.split(" ").slice(-1))
}

var last_result_this_page = function(c) {
    return parseInt(c.getElementInfo(x("//div[@class='title'][(.='Showing results: ')]/..")).text.split(" ").slice(-1))
}

var bigResult = []

var categoryMap = {
    "StG" : "Starting Grant",
    "CoG" : "Consolidator Grant",
    "AdG" : "Advanced Grant",
    "PoC" : "Proof of Concept",
    "SyG" : "Synergy Grants"
}



var addAllPagesFromPointWithCategory = function(category) {
    var addAllPagesFromPoint = function() {
	var result = [];
	var last = null;
	var total = null;
	casper.then( function() {
	    //info = this.getElementsInfo('div.title+div.value')
	    total = total_results(this)
	    last = last_result_this_page( this )
	    this.echo( last + "/" + total )
	    //utils.dump(entriesFromPage(this));
	    var result = entriesFromPage(this)
	    for ( var i = 0; i < result.length; ++i ) {
		result[i].category = categoryMap[category]
	    }
	    bigResult = bigResult.concat( result );
	    if ( last < total ) { //&& last < 9 ) {
		if ( last % 500 ===0) {
		    casper.then( function() { this.echo("Counting to 60 to control anger") } )
		    casper.wait( 60000 );
		}
		//casper.wait( Math.random()*3000+1 )
		casper.thenClick( "div.next.pager" )
		casper.then( function() {this.echo("for loading...")} )
		casper.waitForSelector('img[src="/sites/all/modules/custom/cordis_search/misc/loading.gif"]')
		casper.then( function() {this.echo("for loading done...")} )
		casper.waitWhileSelector('img[src="/sites/all/modules/custom/cordis_search/misc/loading.gif"]')
		casper.then( function() {this.echo("for content...")} )
		casper.waitForSelector('div#content-area')
		
		casper.then(addAllPagesFromPoint)
	    }
	})
    }
    return addAllPagesFromPoint
}


//casper.then( function() {chooseCategory("StG") });

casper.then( function() { 
    categories = [ "StG", "CoG", "AdG", "PoC", "SyG" ];
    for ( var i = 0; i < categories.length; ++i ) {
	chooseCategory( categories[i] );
	casper.then(addAllPagesFromPointWithCategory(categories[i]));
    }
} )

var fs = require('fs')

casper.then( function() { 
    fs.write('test.json', JSON.stringify(bigResult,null,1))
} )

casper.run()
