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

// Moment JS (for date manipulation)
var momentjs = require('moment');

// Pretty Print JSON - Use that till i build an AngularJS UI
var pretty = require('express-prettify');

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

	// Configure Express to use pretty..
	app.use(pretty({
		query : 'pretty'
	}));

});

// get the app environment from Cloud Foundry

var appEnv = cfenv.getAppEnv();

var serviceName = "weatherinsights";

var checkServices = appEnv.services[serviceName];
console.log("checkServices is:" + checkServices);

console.log("App Environemnt is:" + JSON.stringify(appEnv));

var weather_host = appEnv.services[serviceName] ? appEnv.services[serviceName][0].credentials.url // Weather
		// credentials
		// passed
		// in
		: ""; // or copy your credentials url here for stand-alone

// Hard-code for local execution..
weather_host = 'https://3981aee7-448c-4ea3-a254-bac1782cda37:2mSEubBc3i@twcservice.mybluemix.net';

// The default coordinates of Glen Waverley
var defaultCoordinates = latitude + "," + longitude;

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
	var geocode = (req.query.geocode || defaultCoordinates).split(",");

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
	var geocode = (req.query.geocode || defaultCoordinates).split(",");

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
			hoursOfInterest(result.forecasts, function(err, result) {
				// Let's return the original result here..
				res.json(result);
			});

		}
	});
});

app.get('/simpleverdict', function(req, res) {

	var geocode = (req.query.geocode || defaultCoordinates).split(",");

	weatherAPI("/api/weather/v1/geocode/" + geocode[0] + "/" + geocode[1]
			+ "/forecast/hourly/48hour.json", {
		units : req.query.units || "m",
		language : req.query.language || "en"
	}, function(err, result) {
		if (err) {
			res.send(err).status(400);
		} else {
			console.log("24 hours Forecast");

			// This function should return a dress Object
			hoursOfInterest(result.forecasts, function(err, result) {
				res.json(result);
			});

		}
	});
});

// Definition of our Weather Object
function myWeatherObject(localtime, temperature, feelsLike, desc, uvIndex) {
	this.localtime = localtime;
	this.temp = temperature;
	this.feelsLike = feelsLike;
	this.weatherOverview = desc;
	this.uv = uvIndex;
}

// Definition of a DayWeather (high level of the day's weather and also contains
// Day information - Date, is it a holiday (and why e.g. weekend)
function dayWeather(min, minAtHour, max, maxAtHour) {
	this.minimum = min;
	this.minimumTempAt = minAtHour;
	this.maximum = max;
	this.maximumTempAt = maxAtHour;

}

function dayInfo() {

	this.date = momentjs(new Date(), 'DD/MM/YYYY', true).format('DD/MM/YYYY');
	this.dayOfWeek = momentjs().format('dddd');
	this.isHoliday = false;

	if ((this.dayOfWeek == 'Sunday') || (this.dayOfWeek == 'Saturday')) {
		this.isHoliday = true;
	}
}
// Definition of the Verdict Object
function verdict(dress, daySummary, type) {

	this.dress = dress;
	if (type != 'Simple') {
		this.weather = daySummary;
	}
	
	this.day = new dayInfo();

}
// Definition of Dress Object
function dress(hourlyWeather, daySummary) {
	
	//Set the defaults
	this.umbrella = false;
	this.hat = false;
	this.jumper = true;
	
	//if the maximum is above 23 and the minimum is 10 and the period is sunny switch to shorts and half sleeve.
	if (daySummary.maximum >=23){		
		this.bottom = "Shorts";
		this.top = "Half Sleeve";
		this.jumper = false;
		return;
	}
	
	if (daySummary.minimum > 14) {
		this.bottom = "Shorts";
		this.top = "Half Sleeve";

	} else {
		this.bottom = "Full Pant";
		this.top = "Full Sleeve";
		this.jumper = true;
	}

	// Get a bit lenient with Jumper
	// If it is sunny through the day, no winds and Temp is above 12 then he can
	// go without a jumper...

	if (daySummary.minimum < 12) {
		this.jumper = true;
	} else {
		this.jumper = false;
	}

	if (daySummary.maximum > 18) {
		this.hat = true;
	}

	// Based on the rain parameters set this flag..
	this.umbrella = false;
}

// Write a function that extracts the temp info for the period 8AM - 4 PM

// Extract the hours of interest from the forecasts array
function hoursOfInterest(forecasts, callback) {

	// Perform the computation here....

	var hourlyWeather = [];
	var weatherInfo = null;
	var localTime = null;
	var minTemp = 50; // Make it an artifically high number so that the first
	// entry will become the minTemp by default
	var maxTemp = 0;

	var maxTempAtHour;
	var minTempAtHour;

	// Iterate through the forecast array

	for (var i = 0; i < forecasts.length; i++) {

		// Get the temperature only where the time is between 08 and 16 hours -
		// Ignore the day for the moment

		localTime = forecasts[i].fcst_valid_local.substring(11, 19);
		localHour = parseInt(localTime.substring(0, 2));

		// This is the hour of interest to us... 8AM - 4PM
		if (localHour > 7 && localHour < 17) {

			if (forecasts[i].feels_like < minTemp) {
				minTemp = forecasts[i].feels_like;
				minTempAtHour = localHour;
			}

			if (forecasts[i].feels_like > maxTemp) {
				maxTemp = forecasts[i].feels_like;
				maxTempAtHour = localHour;
			}

			console.log("Hour:" + localHour);
			weatherInfo = new myWeatherObject(forecasts[i].fcst_valid_local
					.substring(11, 19), forecasts[i].temp,
					forecasts[i].feels_like, forecasts[i].phrase_32char,
					forecasts[i].uv_index);
			console.log("Weather Info is:" + JSON.stringify(weatherInfo));

			hourlyWeather.push(weatherInfo);

		}
	}

	console.log("Minimum temp in the period of interest is:" + minTemp
			+ " and the maximum is:" + maxTemp);

	var daySummary = new dayWeather(minTemp, minTempAtHour, maxTemp,
			maxTempAtHour);
	var theDress = new dress(hourlyWeather, daySummary);

	callback(null, new verdict(theDress, daySummary, 'Detailed'));

};

app.listen(appEnv.port, appEnv.bind, function() {
	console.log("server starting on " + appEnv.url);
});
