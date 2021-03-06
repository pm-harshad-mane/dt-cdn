'use strict';

var env = require('../config/env.json').current;
var configGeneral = require('../config/general.json')[env];
var configErrors = require('../config/errors.json');
var configInitializeOptions = require('../config/initializeOptions.json');
var helpers = require('./helpers');
var DigiTrustConsent = require('./DigiTrustConsent');
var DigiTrustCookie = require('./DigiTrustCookie');
var DigiTrustCommunication = require('./DigiTrustCommunication');

var LOGID = 'Digitrust'; // const, but older browser support
var logObj = require('./logger');
var log = logObj.createLogger(LOGID, {level: 'ERROR'}); // this will later be re-initialized if the init pass requires
var VERSION = require('../_version.js');

var DigiTrust = {
	version: VERSION
};
var noop = function(){}

DigiTrust.isClient = false; // Is client or server?
DigiTrust.initializeOptions = {};

DigiTrust._isMemberIdValid = function (memberId) {
    if (memberId && memberId.length > 0) {
        return true;
    } else {
        throw new Error(configErrors.en.memberId);
    }
};

/**
* @function
* Set options on the global DigiTrust object by merging base options
* with consumer supplied options.
* @param {object} Consumer-supplied initialization options
* @return {object} The combined options object that was assigned to DigiTrust.initializeOptions
*/
DigiTrust._setDigiTrustOptions = function (options) {
	// we have added a polyfill to handle IE. In this manner the base objects aren't corrupted
	var opts = Object.assign({}, configInitializeOptions, options);
	window.DigiTrust.initializeOptions = opts;
	
	if(opts.logging == null){
		opts.logging = configGeneral.logging
	}
	
	if(opts.logging != null){
		if(opts.logging.enable == false){
			// disable logging
			log = logObj.createLogger(LOGID, {level: 'ERROR'});
			log.enabled = false;
		}
		else{
			if(opts.logging.level == null){
				opts.logging.level = "INFO";
			}
			log = logObj.createLogger(LOGID, opts.logging);
		}			
	}
	
    return window.DigiTrust.initializeOptions;
};


var initInternal = function(options, initializeCallback) {
	log.debug('init Internal');
    try {
        if (initializeCallback === undefined) {
            initializeCallback = noop;
        }
        var identityResponseObject = {success: false};

        options = DigiTrust._setDigiTrustOptions(options);
		log.debug('init options completed');


        // allow for a circuit break to disable the world
        if (Math.random() > options.sample) {
            return initializeCallback(identityResponseObject);
        }

        // Verify Publisher's Member ID
        if (!DigiTrust._isMemberIdValid(options.member)) {
            return initializeCallback(identityResponseObject);
        }

        DigiTrustConsent.hasConsent(null, function (consent) {
            if (consent) {
                DigiTrustCookie.getUser(options, function (err, identityObject) {
                    if (!err) {
                        identityResponseObject.success = true;
                        identityResponseObject.identity = identityObject;
                    }
                    return initializeCallback(identityResponseObject);
                });
            } else {
                return initializeCallback(identityResponseObject);
            }
        });
    } catch (e) {
		log.error('Error in DigiTrust initializer', e);
        return initializeCallback({success: false});
    }
	
}

DigiTrust.initialize = function (options, initializeCallback) {
	var document = window.document;
	var ready = document.readyState;
	
	if(!ready || ready == 'loading') { 
		document.addEventListener("DOMContentLoaded", function(event) {
			DigiTrust.initialize(options, initializeCallback);
		});
	}
	else{
		initInternal(options, initializeCallback);
	}	
};

DigiTrust.getUser = function (options, callback) {

    options = DigiTrust._setDigiTrustOptions(options);
    var async = (typeof callback === 'function') ? true : false;
    var identityResponseObject = {
        success: false
    };

    try {
        // Verify Publisher's Member ID
        if (!DigiTrust._isMemberIdValid(options.member)) {
            return (async === false) ? identityResponseObject : callback(identityResponseObject);
        }

        if (async === false) {
            // Get publisher cookie
            var identityJSON = DigiTrustCookie.getUser();
            if (!helpers.isEmpty(identityJSON)) {
                identityResponseObject.success = true;
                identityResponseObject.identity = identityJSON;
            }
            return identityResponseObject;
        } else {
            DigiTrustConsent.hasConsent(null, function (consent) {
                if (consent) {
                    options.ignoreLocalCookies = true;
                    DigiTrustCookie.getUser(options, function (err, identityObject) {
                        if (err) {
                            return callback(identityResponseObject);
                        } else {
                            identityResponseObject.success = true;
                            identityResponseObject.identity = identityObject;
                            return callback(identityResponseObject);
                        }
                    });
                } else {
                    return callback(identityResponseObject);
                }
            });
        }
    } catch (e) {
        return (async === false) ? identityResponseObject : callback(identityResponseObject);
    }
};

DigiTrust.sendReset = function (options, callback) {
    DigiTrustCommunication.sendReset();
};

module.exports = {
    initialize: DigiTrust.initialize,
    initializeOptions: DigiTrust.initializeOptions,
    getUser: DigiTrust.getUser,
    sendReset: DigiTrust.sendReset,
    isClient: DigiTrust.isClient
};
