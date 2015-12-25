var fx = require('money');
var imraising = require('imraising-tracker');
var oxr = require('open-exchange-rates');
var request = require('request');
var Q = require('q');

module.exports = function(nodecg) {
    var client = new imraising({
        key: nodecg.bundleConfig.imraisingKey
    });

    var latestDonation = nodecg.Replicant('latestDonation', {defaultValue: null});
    var topDonor = nodecg.Replicant('topDonor', {defaultValue: null});
    var totals = nodecg.Replicant('totals', {defaultValue: null});

    oxr.set({app_id: nodecg.bundleConfig.oerAppID});

    oxr.latest(function() {
        fx.rates = oxr.rates;
        fx.base = oxr.base;

        // wait 100ms for APIs to catch up before updating due to desync errors
        client.addListener('donation.add', function(donation) {
            setTimeout(updateTotal, 100);
        });
        client.addListener('donation.delete', function(donation) {
            setTimeout(updateTotal, 100);
        });

        updateTotal();
    });

    function updateTotal() {
        Q.allSettled([
            client.getDonations({startDate: nodecg.bundleConfig.startDate}).then(function(donations) {
                var latestDonation = donations[0];

                latestDonation.amount.display.total = fx(latestDonation.amount.display.total).from(latestDonation.amount.display.currency).to('USD');
                latestDonation.amount.display.currency = 'USD';

                return latestDonation;
            }),
            client.getTopDonors({startDate: nodecg.bundleConfig.startDate}).then(function(donors) {
                var topDonor = donors[0];

                topDonor.amount.total = fx(topDonor.amount.total).from(topDonor.amount.currency).to('USD');
                topDonor.amount.currency = 'USD';

                return topDonor;
            }),
            Q.fcall(function() {
                var totals = {
                    amount: 0,
                    donations: 0
                };
                var page = 0;

                function getDonations(page) {
                    return client.getDonations({offset: page * 100, limit: 100, startDate: nodecg.bundleConfig.startDate});
                }

                function handleDonations(donations) {
                    donations.forEach(function(donation) {
                        totals.amount += fx(donation.amount.display.total).from(donation.amount.display.currency).to('USD');
                    });

                    totals.donations += donations.length;

                    if (donations.length >= 100) {
                        return getDonations(++page).then(handleDonations);
                    }
                    else {
                        return totals;
                    }
                }

                return getDonations(0).then(handleDonations);
            })
        ]).then(function(results) {
            if (results[0].state == 'fulfilled') {
                latestDonation.value = results[0].value;
            }
            else {
                console.log(results[0].reason);
            }

            if (results[1].state == 'fulfilled') {
                topDonor.value = results[1].value;
            }
            else {
                console.log(results[1].reason);
            }

            if (results[2].state == 'fulfilled') {
                totals.value = results[2].value;
            }
            else {
                console.log(results[2].reason);
            }
        });
    }
}
