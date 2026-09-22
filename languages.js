const fs = require('fs');
const path = require('path');
const csvjson = require('csvjson');

// Collapses a folder of Crowdin CSV exports into one resources/languages/<locale>.js
// per locale, each assigning into a global `locale[]` array that index.html injects
// before the app boots.
//
// The download half of this pipeline is gone. It called Crowdin's v1 API, which
// answers 301 now, through a package that throws `primordials is not defined` on
// a modern Node, against api.crowdin.net/api/project/rambox -- upstream's project,
// which this fork does not own. Nothing here could have worked. Until a Crowdin
// project is set up for this fork, the generated .js files are the only source
// there is, so a correction goes into them directly. Drop CSV exports into
// resources/languages/<locale>/ and this rebuilds that locale from them.

var args = process.argv.slice(2);

if ( args.indexOf('generate') >= 0 ) {
	const languages = path.join(__dirname, 'resources', 'languages');
	fs.readdirSync(languages).filter(file => fs.lstatSync(path.join(languages, file)).isDirectory()).forEach(function(locale) {
		var result = 'var locale=[];';
		var localeDir = path.join(languages, locale);
		fs.readdirSync(localeDir).forEach(function(file) {
			var data = fs.readFileSync(path.join(localeDir, file), { encoding : 'utf8'});
			csvjson.toObject(data, {
				 headers: 'prop,text'
				,delimiter: ','
				,quote: '"'
			}).forEach(function(obj) {
				result += 'locale["'+obj.prop+'"]="'+obj.text+'";';
			});
		});
		result += 'module.exports = locale;';
		fs.writeFileSync(path.join(languages, locale + '.js'), result);
		console.log(locale, "File was generated!");
		fs.rmSync(localeDir, { recursive: true, force: true });
	});
}

if ( args.length === 0 ) console.error('Pass generate to rebuild the locale files from CSV exports.');
