'use strict';

var env = require('../config/env.json').current;
var configGeneral = require('../config/general.json')[env];

var DigiTrustConsent = {};

DigiTrustConsent.browserLanguageIsEU = function (languages) {
    for (var i = 0; i < languages.length; i++) {
        if (configGeneral.gdprLanguages.indexOf(languages[i].toLowerCase()) >= 0) {
            return true;
        }
    }
    return false;
};

DigiTrustConsent.cmpConsent = function (languages) {
    return false;
};

DigiTrustConsent.gdprApplies = function (options) {
    var browserLanguageCheckResult = DigiTrustConsent.browserLanguageIsEU(navigator.languages ||
        [navigator.browserLanguage]);
    return browserLanguageCheckResult;
};

DigiTrustConsent.hasConsent = function (options, callback) {
    var applies = DigiTrustConsent.gdprApplies();
	if(env === 'local' || env === 'localdev'){ applies = false; } // dev test
	
    if (typeof(window.__cmp) !== 'undefined') {
        window.__cmp('ping', null, function (pingReturn) {
            if (applies || (pingReturn.gdprAppliesGlobally)) {
                window.__cmp('getVendorConsents', [configGeneral.gvlVendorId], function (result) {
                    var myconsent = result.vendorConsents[configGeneral.gvlVendorId];
                    callback(myconsent);
                });
            } else {
                callback(true);
            }
        });
    } else if (applies) {
        callback(false);
    } else {
        callback(true);
    }
};

module.exports = {
    hasConsent: DigiTrustConsent.hasConsent
};
