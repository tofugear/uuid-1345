var child = require('child_process');
var async = require('async');
var sprintf = require('sprintf-js').sprintf;
var printf = function () { console.log(sprintf.apply(null, arguments)); };

function Sync(func) { this.func = func; }
function Async(func) { this.func = func; }

var target = process.argv[2] || "";
var times  = process.argv[3] || 10000;
var warmup = process.argv[4] || 100;
var offset = process.argv[5] || 500;

var scenarios = {

    'node-uuid-v1': function () {
        var uuid = require('node-uuid');
        return new Sync(uuid.v1);
    },

    'node-uuid-v4': function () {
        var uuid = require('node-uuid');
        return new Sync(uuid.v4);
    },

    'sync-v1': function () {
        var UUID = require('../index');
        return new Sync(UUID.v1);
    },

    'sync-v3': function () {
        var UUID = require('../index');
        return new Sync(UUID.v3.bind(null, {
            name: "https://github.com/scravy/node-1345",
            namespace: UUID.namespace.url
        }));
    },

    'sync-v4': function () {
        var UUID = require('../index');
        return new Sync(UUID.v4);
    },

    'sync-v5': function () {
        var UUID = require('../index');
        return new Sync(UUID.v5.bind(null, {
            name: "https://github.com/scravy/node-1345",
            namespace: UUID.namespace.url
        }));
    },

    'async-v1': function () {
        var UUID = require('../index');
        return new Async(UUID.v1);
    },

    'async-v3': function () {
        var UUID = require('../index');
        return new Async(UUID.v3.bind(null, {
            name: "https://github.com/scravy/node-1345",
            namespace: UUID.namespace.url
        }));
    },

    'async-v4': function () {
        var UUID = require('../index');
        return new Async(UUID.v4);
    },

    'async-v5': function () {
        var UUID = require('../index');
        return new Async(UUID.v5.bind(null, {
            name: "https://github.com/scravy/node-1345",
            namespace: UUID.namespace.url
        }));
    }
};

var scenario = scenarios[target || ''];

if (typeof scenario === 'function') {
    scenario = scenario();
}

if (scenario instanceof Sync) {

    var func = scenario.func;

    // warm up
    for (var i = 0; i < warmup; i++) {
        func();
    }

    // benchmark
    setTimeout(function () {
        var uuids = [];

        console.time(target);
        for (var i = 0; i < times; i++) {
            uuids.push(func());
        }
        console.timeEnd(target);
    }, offset);

} else if (scenario instanceof Async) {
    
    var func = scenario.func;

    var uuids = [];

    setTimeout(function () {
        console.time(target);
        async.times(times, function (n, done) {
            func(function (err, uuid) {
                uuids.push(uuid);
                done();
            });
        }, function () {
            console.timeEnd(target);
        });
    }, offset);

} else {

    var results = {};
    var benchmarks = [];
    Object.keys(scenarios).forEach(function (scenario) {
        results[scenario] = [];
        benchmarks.push(function (done) {
            var command = sprintf("node %s %s %d %d %d",
                    module.filename, scenario, times, warmup, offset);
            child.exec(command, function (err, stdout, stderr) {
                if (err) {
                    return console.log(err);
                }
                results[scenario].push(parseInt(stdout.trim().split(' ')[1]));
                done();
            });
        });
    });

    function sum(arr) {
        var sum = 0;
        arr.forEach(function (val) { sum += val; });
        return sum;
    }

    function min(arr) {
        var min = arr[0];
        arr.forEach(function (val) { min = Math.min(min, val); });
        return min;
    }

    function max(arr) {
        var max = arr[0];
        arr.forEach(function (val) { max = Math.max(max, val); });
        return max;
    }

    async.timesSeries(parseInt(target) || 10, function (n, done) {
        async.waterfall(benchmarks, done);
    }, function () {

        printf("%12s %8s %8s %8s", "BENCHMARK", "MEAN", "MIN", "MAX");

        Object.keys(results).forEach(function (name) {
            var values = results[name];
            var mean = sum(values) / values.length;
            printf("%12s %8.2f %8.2f %8.2f", name, mean, min(values), max(values));
        });
    });
}