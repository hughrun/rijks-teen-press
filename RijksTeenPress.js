// require modules
const feedparser = require('feedparser-promised');
const fs = require('fs');
const gm = require('gm');
const Random = require('random-js');
r = new Random();
const request = require('request');
const Twit = require('twit');

// set up twit
var T = new Twit({
  consumer_key:         process.env.TWITTER_KEY,
  consumer_secret:      process.env.TWITTER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_TOKEN_SECRET
});

// set up feedparser
const feed = 'http://www.teenvogue.com/rss';
var titles = [];

function getTitles() {
	// get titles from feed
	feedparser.parse(feed).then( (items) => {
		items.forEach( (item) => {
		  titles.push(`${item.title}`);
		});

		const title = r.pick(titles);
		const titleArray = title.split(" ");
		var lastWord = titleArray[titleArray.length - 1];
		const query = lastWord	 
		getImage(query)

		function getImage(query) {
			const rijksmuseumKey = process.env.RM_API_KEY // API key for Rijksmuseum
			const url = `https://www.rijksmuseum.nl/api/en/collection?key=${rijksmuseumKey}&format=json&imgonly=true&ps=100&q=${query}`;
			console.log(`using ${query} as the search query...`)
			request.get(url, function (error, response, data){
				if (error) {
					console.log('### error getting RM url ###');
					console.log(error);
				};
				 if (!error && response.statusCode == 200) {
					var parsed = JSON.parse(data);	
					var objects = parsed.artObjects;
					var pics = [];
					if (objects.length > 0) {
						objects.forEach((artwork) => {
							if (artwork.permitDownload === true) {
								pics.push(artwork.webImage.url)
							}
						});
						choosePicture()

						function choosePicture() {
							const pic = r.pick(pics);
							gm(pic).size((err, value) => {
								if (err) {
									// usually this error is caused because 'pics' is empty, so we force it to search the API again
									console.error(`error checking image size: ${err}`);
									getImage();
								} else if (value.width > 300) {
									savePic(pic, titleArray);
									pics = [];
									titles= [];
								} else {
									choosePicture()
								}
							});
						}				
					} else {
						// if the query returns nothing, choose another random word from the title and try again
						query = r.pick(titleArray);
						getImage(query)
					}
				 };
			});
		}
	}).catch( (error) => {
		console.error('feedparser error: ', error);
	});
}

function savePic (pic, titleArray) {
	var newTitle = ""
	for (i = 0; i < titleArray.length; i++){
		// print the first word
		if (i === 0) {
			newTitle += `${titleArray[i]} `
		}
		// if this word plus the words on either side add up to less than 18 characters...
		else if (i > 0 && titleArray[i+1] && (titleArray[i-1].length + titleArray[i].length + titleArray[i+1].length) < 18) {
			if ((i + 1) % 3 === 0) {
				// add a line break after every third word
				newTitle += `${titleArray[i]}\n`;
			} else {
				newTitle += `${titleArray[i]} `
			}			
		} else {
			// if this word plus its neigbours add up to more than 17 characters but the previous word has a line break,
			// don't add another line break
			const prevWord = newTitle.lastIndexOf(titleArray[i-1]);
			if (newTitle.includes('\n', prevWord)) {
				newTitle += `${titleArray[i]} `;
			} else {
				// otherwise, do add a line break
				newTitle += `${titleArray[i]}\n`;
			}
		}
	}
	const picStream = request(pic).pipe(fs.createWriteStream('cover-art.jpg', {autoClose: true}));
	// log errors
	picStream.on('error', function(error){
		console.error('#### error saving pic ####');
		console.error(error);
	});
	// when pipe ends	
	picStream.on('finish', () => addTitle(newTitle));
};

function addTitle(newTitle) {
	gm('cover-art.jpg')
	// resize with these width/height measures as the minimums
	.resize(300, 450, '^')
	.autoOrient()
	.stroke('#000')
	.fill('#fff')
	.font('fonts/Alegreya-Black.otf', 24)
	.drawText(25, 75, `${newTitle}`, 'Northwest')
	.write('with-title.jpg', function (err) {
	  if (!err) {
	  	console.log('added Title');
	  	addPublisher()
	  } else {
	  	console.error(`****** error adding Title: ${err}`)
	  	getTitles();
	  }
	});
};

function addPublisher() {
	gm('with-title.jpg')
	// .stroke('#c4bea2')
	// .stroke('#fd4703')
	.fill('#fd4703')
	.font('fonts/Dosis-Bold.otf', 14)
	.drawText(0, 25, 'A Rjiks Teen Classic', 'North')
	.write('final.jpg', function (err) {
	  if (!err) {
	  	console.log('added Publisher');
	  	announce();
	  } else {
	  	console.error(`******* error adding Publisher: ${err}`);
	  	getTitles();
	  }
	});	
}

function announce() {
	// encode the image as Base64
	var image = fs.readFileSync('final.jpg', { encoding: 'base64'});

	// first we must post the media to Twitter 
	T.post('media/upload', { media_data: image }, function (err, data, response) {
		 if (err){
		 	console.log('### error uploading pic');
		 	console.log(err);
		 };
		// now we can reference the media and post a tweet (media will attach to the tweet) 
	 	var mediaIdStr = data.media_id_string;
		var params = { media_ids: [mediaIdStr] }
	 
		T.post('statuses/update', params, function (err, data, response) {
		  	if (err) {
		  		console.log('### error posting to Twitter ###');
		  		console.log(error);
		  	};
		    console.log(data.text)
	  });
	});
	image = null;
}

// GO!
console.log('running...')
// test run first
getTitles();
// cycle every 5 hours
var interval = setInterval(getTitles, 1.8e+7);