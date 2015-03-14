var fx = require('money');
var imraising = require('imraising-tracker');
var oxr = require('open-exchange-rates');
var request = require('request');
var q = require('q');

// no extension config so just load config.json in local directory :/
// var config = require('./config.json');

module.exports = function(nodecg) {
    console.log(nodecg.bundleConfig);

    var client = new imraising({
        key: nodecg.bundleConfig.imraisingKey
    });

    nodecg.declareSyncedVar({
        name: 'total',
        initialVal: 0
    });

    oxr.set({app_id: nodecg.bundleConfig.oerAppID});

    oxr.latest(function() {
        fx.rates = oxr.rates;
        fx.base = oxr.base;

        client.addListener('donation.add', updateTotal);
        client.addListener('donation.delete', updateTotal);

        updateTotal();
    });

    function getDonors(page) {
        return client.getTopDonors({offset: page * 0, limit: 100, startDate: nodecg.bundleConfig.startDate});
    }

    function updateTotal() {
        total = 0;
        page = 0;

        getDonors(0).then(function(donors) {
            donors.forEach(function(donor) {
                total += fx(donor.amount.total).from(donor.amount.currency).to('USD');
            });

            if (donors.length >= 100) {
                return getDonors(++page);
            }
            else {
                return;
            }
        }, function(err) {
            console.log(err);
        }).fin(function() {
            nodecg.variables.total = total;
        });
    }
}
