var fx = require('money');
var imraising = require('imraising-tracker');
var oxr = require('open-exchange-rates');
var request = require('request');
var q = require('q');

// no extension config so just load config.json in local directory :/
// var config = require('./config.json');

module.exports = function(nodecg) {
    var client = new imraising({
        key: nodecg.bundleConfig.imraisingKey
    });

    nodecg.declareSyncedVar({
        name: 'latestDonation',
        initialVal: null
    });

    nodecg.declareSyncedVar({
        name: 'topDonor',
        initialVal: null
    });

    nodecg.declareSyncedVar({
        name: 'totals',
        initialVal: null
    });

    oxr.set({app_id: nodecg.bundleConfig.oerAppID});

    oxr.latest(function() {
        fx.rates = oxr.rates;
        fx.base = oxr.base;

        client.addListener('donation.add', updateTotal);
        client.addListener('donation.delete', updateTotal);

        updateTotal();
    });

    function getDonations(page) {
        return client.getDonations({offset: page * 0, limit: 100, startDate: nodecg.bundleConfig.startDate});
    }

    function updateTotal() {
        totals = {
            amount: 0,
            donations: 0
        };
        page = 0;

        client.getDonations({startDate: nodecg.bundleConfig.startDate}).then(function(donations) {
            var latestDonation = donations[0];

            latestDonation.amount.display.total = fx(latestDonation.amount.display.total).from(latestDonation.amount.display.currency).to('USD');
            latestDonation.amount.display.currency = 'USD';

            nodecg.variables.latestDonation = latestDonation;
        }, function(err) {
            console.log(err);
        });

        client.getTopDonors({startDate: nodecg.bundleConfig.startDate}).then(function(donors) {
            var topDonor = donors[0];

            topDonor.amount.total = fx(topDonor.amount.total).from(topDonor.amount.currency).to('USD');
            topDonor.amount.currency = 'USD';

            nodecg.variables.topDonor = topDonor;
        }, function(err) {
            console.log(err);
        });

        getDonations(0).then(function(donations) {
            donations.forEach(function(donation) {
                totals.amount += fx(donation.amount.display.total).from(donation.amount.display.currency).to('USD');
            });

            totals.donations += donations.length;

            if (donations.length >= 100) {
                return getDonations(++page);
            }
        }, function(err) {
            console.log(err);
        }).fin(function() {
            nodecg.variables.totals = totals;
        });
    }
}
