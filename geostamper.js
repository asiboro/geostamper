/**
 * This script takes a directory of images, looks for GPS
 * coordinates in each file, and then writes the filename and
 * decimal degrees to CSV. If you're pulling images off of your
 * iPhone, using Image Capture is a quick way to move them onto
 * your computer and get started.
 *
 * Make sure you have imagemagick installed:
 *   $ brew install imagemagick
 * Download these files and install dependencies:
 *   $ npm install
 * Run:
 *   $ node index.js ~/Pictures/iphone/ > images.csv
 *
 * Graph them on a map using something like TileMill, here's a good starter:
 *   http://mapbox.com/tilemill/docs/crashcourse/point-data/
 *
 **/
// Get GPS data from image and then go reverse geocoding to find location
//
// Arnold P. Siboro
// 
// Do like this to check map based on long/lat:
//    http://maps.google.com/?q=-6.303775,106.683137
//
var im = require('imagemagick');
var fs = require('fs');
var async = require('async');
// https://www.npmjs.org/package/search-osm-geocode
var geocoder = require('search-osm-geocode');
var gpsvillage, gpsstate, gpsdisplayname;
var imagewidth, imageheight;
//const LANGUAGE = 'en';
const LANGUAGE = 'id';
//console.log(['file', 'latitude', 'longitude'].join(','));
// you can use Google options to manage result format
var options = {
    'accept-language': LANGUAGE
};
var processfiles = 0;
var outputcsv = 0;
var logdata;
var outputlog=1;


// Convert location from degrees (DMS) to decimal format
// See http://stackoverflow.com/questions/1140189/converting-latitude-and-longitude-to-decimal-values
var ConvertDMSToDD = function(days, minutes, seconds, direction) {
        var dd = days + minutes / 60 + seconds / (60 * 60);
        // Invert south and west.
        if (direction == 'S' || direction == 'W') {
            dd = dd * -1;
        }
        return dd;
    }
    // Get all contents of the directory and pass it to readData object, which is a function
    // See http://nodejs.org/api/fs.html#fs_fs_readdir_path_callback
fs.readdir(process.argv[2], function(err, files) {
    if (err) throw err;
    // Limit im.readMetadata since it doesn't like having too many open file descriptors.
    // See this for async.eachLimit https://github.com/caolan/async#forEachLimit
    async.eachLimit(files, 5, readData, function(err) {
        if (err) throw err;
        // done!
    });
});
// Get long/lat from image file's metadata, do reverse geocoding and then annotate the address into the image
var readData = function(file, callback) {
    if (file.match(/\.jpg/i) !== null) {
        im.readMetadata(process.argv[2] + file, function(err, metadata) {
            if (err) throw err;
            if (typeof metadata.exif !== 'undefined' && typeof metadata
                .exif.gpsLatitude !== 'undefined' && typeof metadata
                .exif.gpsLongitude !== 'undefined') {
                var degreeLatitude = metadata.exif.gpsLatitude.split(
                    ', ')
                var degreeLongitude = metadata.exif.gpsLongitude.split(
                    ', ')
                var latitude = ConvertDMSToDD(parseInt(
                        degreeLatitude[0].split('/')[0]) /
                    parseInt(degreeLatitude[0].split('/')[1]),
                    parseInt(degreeLatitude[1].split('/')[0]) /
                    parseInt(degreeLatitude[1].split('/')[1]),
                    parseInt(degreeLatitude[2].split('/')[0]) /
                    parseInt(degreeLatitude[2].split('/')[1]),
                    metadata.exif.gpsLatitudeRef);
                var longitude = ConvertDMSToDD(parseInt(
                        degreeLongitude[0].split('/')[0]) /
                    parseInt(degreeLongitude[0].split('/')[1]),
                    parseInt(degreeLongitude[1].split('/')[0]) /
                    parseInt(degreeLongitude[1].split('/')[1]),
                    parseInt(degreeLongitude[2].split('/')[0]) /
                    parseInt(degreeLongitude[2].split('/')[1]),
                    metadata.exif.gpsLongitudeRef);

                async.series(
                    [
                        function(callback) {
							// { format: 'JPEG', width: 3904, height: 2622, depth: 8 }
							im.identify(process.argv[2] + file, function(err, features) {
                    			if (err) throw(err);
								imagewidth=features.width;
								imageheight=features.height;
								logdata=features.width+'x'+features.height+"|";
                			});
                            callback();


                        },
                        function(callback) {
                            //Do reverse geocoding to get address from long/lat
                            //geocoder.reverseGeocode(latitude, longitude, callback2, options);
			        		logdata=logdata+[file, latitude, longitude].join(',');
							logdata=logdata+"\n";
                            geocoder.reverseGeocode(latitude,
                                longitude, function(error,
                                    result) {
                                    if (error) console.log(
                                        error); // on error
                                    else {
                                        //console.log(result);
										if(result && result.address){
                                        	gpsvillage = result.address.village;
                                        	gpsstate = result.address.country;
                                        	gpsdisplayname = result.display_name;
										}
                                    }
                                    callback();
                                }, options);
                        },
                        function(callback) {
                            // Output to stdout first
                            var deglat = degreeLatitude[0].split(
                                    "/")[0] / degreeLatitude[0]
                                .split("/")[1] + '°' +
                                degreeLatitude[1].split("/")[0] /
                                degreeLatitude[1].split("/")[1] +
                                '\'' + degreeLatitude[2].split(
                                    "/")[0] / degreeLatitude[2]
                                .split("/")[1] + '\" ' +
                                metadata.exif.gpsLatitudeRef;
                            var deglong = degreeLongitude[0].split(
                                    "/")[0] / degreeLongitude[0]
                                .split("/")[1] + '°' +
                                degreeLongitude[1].split("/")[0] /
                                degreeLongitude[1].split("/")[1] +
                                '\'' + degreeLongitude[2].split(
                                    "/")[0] / degreeLongitude[2]
                                .split("/")[1] + '\" ' +
                                metadata.exif.gpsLongitudeRef;
                            if(outputcsv) console.log([file, latitude,
                                longitude, deglat,
                                deglong, gpsdisplayname
                            ].join(','));

                            //Set options for ImageMagick's convert command

/*
                            var args = [
                                process.argv[2] + file,
                                "-gravity", "south",
                                "-pointsize", "72",
                                "-stroke", "#000C",
                                "-strokewidth", "2",
                                "-annotate", "0",
                                gpsdisplayname, "-stroke",
                                "none", "-fill", "white",
                                "-annotate", "0",
                                gpsdisplayname,
                                process.argv[2] + "New-" +
                                file
                            ];
*/

//See http://www.imagemagick.org/Usage/annotating/ for auto-sized caption

/*
                            var args = [
                                "-background", "#0008",
                                "-fill", "white",
                                "-size", imagewidth+"x"+imageheight/10,
                                "caption:", gpsdisplayname,
                                process.argv[2] + file,
								"+swap","-gravity", "center","-composite", 
								process.argv[2] + "New-" +file,
                            ];
*/

                            var args = [
								"-background", "rgba\(0,0,0,0\)",
                                "-fill", "white",
								"-gravity", "center",
                                "-size", imagewidth+"x"+imageheight/10,
                                "caption:"+gpsdisplayname,
                                process.argv[2] + file,
								"+swap",
								"-gravity", "south",
								"-composite", 
								process.argv[2] + "New-" +file,
                            ];

							//console.log(args);

                            //Use ImageMagick to overlay the text onto the image
                            
							if(processfiles) im.convert(args, file, function(err, file) {
                    			if (err) callback(err);
								//console.log(process.argv[2]+"New-"+file);
                			});

                            callback();
                        }
                    ], function(err) {
                        if (err) callback(err);
                        if(outputlog) console.log(logdata);
                    });
            }
            callback();
        });
    } else {
        callback();
    }
};