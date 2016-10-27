// app.js
//*************************************************************************
// Copyright 2016 IBM Corp.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//*************************************************************************

var express = require('express');
var request = require('request');
var cfenv = require('cfenv');

// Security - helmet
var helmet = require('helmet');

// setup middleware
var app = express();
var ninetyDaysInMilliseconds = 7776000000;

// This is the latitude and Longitude for Glen Waverley, VIC 3150
var latitude = '-37.8828820';
var longitude = '145.1776060';

app.configure(function() {
	app.use(express.static(__dirname + '/public'));
	// set the HTTP Strict Transport Security (HSTS) header for 90 days
	app.use(helmet.hsts({
		maxAge : ninetyDaysInMilliseconds,
		includeSubdomains : true,
		force : true
	}));
	// Prevent Cross-site scripting (XSS) attacks
	app.use(helmet.xssFilter());
});

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

var serviceName = "weatherinsights";

var checkServices = appEnv.services[serviceName];
console.log("checkServices is:" + checkServices);

var creds = appEnv.services[serviceName][0].credentials;
console.log("Credentials are:" + creds);

var weather_host = appEnv.services[serviceName] ? appEnv.services[serviceName][0].credentials.url // Weather
		// credentials
		// passed
		// in
		: ""; // or copy your credentials url here for standalone

function weatherAPI(path, qs, done) {

	console.log("Weather Host is:" + weather_host);
	var url = weather_host + path;
	console.log(url, qs);
	request({
		url : url,
		method : "GET",
		headers : {
			"Content-Type" : "application/json;charset=utf-8",
			"Accept" : "application/json"
		},
		qs : qs
	}, function(err, req, data) {
		if (err) {
			// If an error occurs log that error...
			done(err);
		} else {
			if (req.statusCode >= 200 && req.statusCode < 400) {
				try {
					done(null, JSON.parse(data));
				} catch (e) {
					console.log(e);
					done(e);
				}
			} else {
				console.log(err);
				done({
					message : req.statusCode,
					data : data
				});
			}
		}
	});
}

app.get('/api/forecast/daily', function(req, res) {
	var geocode = (req.query.geocode || "45.43,-75.68").split(",");

	// Hard-coding these for the moment...
	geocode[0] = latitude;
	geocode[1] = longitude;

	weatherAPI("/api/weather/v1/geocode/" + geocode[0] + "/" + geocode[1]
			+ "/forecast/daily/10day.json", {
		units : req.query.units || "m",
		language : req.query.language || "en"
	}, function(err, result) {
		if (err) {
			console.log(err);
			res.send(err).status(400);
		} else {
			console.log("10 days Forecast");
			res.json(result);
		}
	});
});

app.get('/api/forecast/hourly', function(req, res) {
	var geocode = (req.query.geocode || "45.43,-75.68").split(",");

	// Hard-coding these for the moment...
	geocode[0] = latitude;
	geocode[1] = longitude;

	weatherAPI("/api/weather/v1/geocode/" + geocode[0] + "/" + geocode[1]
			+ "/forecast/hourly/48hour.json", {
		units : req.query.units || "m",
		language : req.query.language || "en"
	}, function(err, result) {
		if (err) {
			res.send(err).status(400);
		} else {
			console.log("24 hours Forecast");
			result.forecasts.length = 24; // we require only 24 hours for UI

			// Invoke hoursOfInterest
			hoursOfInterest(forecasts, function(err, result) {
				// Let's return the original result here..
				res.json(result);
			});

		}
	});
});

// Write a function that extracts the temp info for the period 8AM - 4 PM
/*
 * 
 * The elements of interest are: "temp": 14, "dewpt": 5, "hi": 14, "wc": 13,
 * "feels_like": 13,
 * 
 */

// Extract the hours of interest from the forecasts array
function hoursOfInterest(forecasts, callback) {
	console.log('Inside the hours of Interest .....');

	// Perform the computation here....
	var interestedInfo = forecasts.length = 24;

	// Iterate through the forecast array

	forecasts.forEach(function(key, value) {
		if (key === 'fcst_valid_local')
			console.log("Time:" + value);

		if ((key === 'temp') || (key === 'feels_like')) {
			console.log(key);
			console.log(value);
		}

	});

};

// invoke async function:
console.log('I will be logged first');
login(username, password, function(err, result) {
	console.log('I will be logged fourth');
	console.log('The user is', result)
});

app.listen(appEnv.port, appEnv.bind, function() {
	console.log("server starting on " + appEnv.url);
});
