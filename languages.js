const fs = require('fs');
const path = require('path');
const csvjson = require('csvjson');
// crowdin is required inside the download branch on purpose. The package
// predates modern Node and throws while loading, which used to break the
// generate command too even though it never touches the API.

var deleteFolderRecursive = function(path) {
	if( fs.existsSync(path) ) {
		fs.readdirSync(path).forEach(function(file,index){
			var curPath = path + "/" + file;
			if(fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

var args = process.argv.slice(2);

if ( args.indexOf('download') >= 0 ) {
	// The key was written here in plain text. Removing it does not un-leak it:
	// it is still in this repository's history and in the archived upstream, so
	// it has to be revoked on Crowdin rather than trusted because of this change.
	const apiKey = process.env.CROWDIN_API_KEY;
	if ( !apiKey ) {
		console.error('Set CROWDIN_API_KEY in the environment to download translations.');
		process.exit(1);
	}

	const Crowdin = require('crowdin');
	const crowdin = new Crowdin({
		 apiKey: apiKey
		,endpointUrl: 'https://api.crowdin.net/api/project/rambox'
	});
	crowdin.downloadToPath('resources/languages').then(function() { console.info('Download finished!') });
}

if ( args.indexOf('generate') >= 0 ) {
	fs.readdirSync(__dirname+'/resources/languages').filter(file => fs.lstatSync(path.join(__dirname+'/resources/languages', file)).isDirectory()).forEach(function(locale) {
		var result = 'var locale=[];';
		var path = __dirname+'/resources/languages/'+locale;
		fs.readdirSync(path).forEach(function(file) {
			var data = fs.readFileSync(path+'/'+file, { encoding : 'utf8'});
			csvjson.toObject(data, {
				 headers: 'prop,text'
				,delimiter: ','
				,quote: '"'
			}).forEach(function(obj) {
				result += 'locale["'+obj.prop+'"]="'+obj.text+'";';
			});
		});
		result += 'module.exports = locale;';
		fs.writeFileSync(path+'/../'+locale+'.js', result);
		console.log(locale, "File was generated!");
		deleteFolderRecursive(path);
	});
}

if ( args.length === 0 ) console.error('No arguments passed');
