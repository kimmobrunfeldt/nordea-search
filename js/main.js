var Config = function() {
    var config = {
        // Key to currencies
        currency: 'euro',

        currencies: {
            euro: '€',
            crown: 'kr'
        }

    };

    return config;
}();

var Nordea = function($, _, moment) {
    var api = {};

    function isLineTransaction(line) {
        // If line is not empty and first word contains dot(it's a date)
        return line && _.str.include(_.str.words(line)[0], '.');
    }

    function parseTransactionLine(line) {
        var words = _.str.words(line);
        return {
            date: moment(words[2], 'DD.MM.YYYY'),
            amount: parseFloat(words[3].replace(',', '.')),

            // Remove the unnecessary dates from the beginning
            line: _.str.words(line).slice(2).join(' ')
        };
    }

    api.parseTransactions = function(text) {
        var lines = _.str.lines(text);
        var transactionLines = _.filter(lines, isLineTransaction);
        return _.map(transactionLines, parseTransactionLine);
    };

    return api;
}(jQuery, _, moment);


$(function () {
    var Bank = Nordea;
    var config = Config;

    function filterTransaction(transaction, filters) {
        var caseSensitive = filters.caseSensitive;
        var line = caseSensitive ? transaction.line : transaction.line.toLowerCase();
        var wordsFound = _.map(filters.words, function(word) {
            return _.str.include(line, word);
        });

        return (_.any(wordsFound) || filters.words.length === 0) &&
               isAmountInBoundaries(transaction, filters) &&
               isDateInBoundaries(transaction, filters);
    }

    function isDateInBoundaries(transaction, filters) {
        return (transaction.date >= filters.minDate) &&
               (transaction.date <= filters.maxDate);
    }

    function isAmountInBoundaries(transaction, filters) {
        return (transaction.amount >= filters.minAmount) &&
               (transaction.amount <= filters.maxAmount);
    }

    function render(text, filters) {
        var transactions = Bank.parseTransactions(text);
        var filteredTransactions = _.filter(transactions, function(t) {
            return filterTransaction(t, filters);
        });

        renderTransactionList(filteredTransactions);
        renderTotalAmount(filteredTransactions);
    }

    function renderTransactionList(transactions) {
        var context = {transactions: transactions};
        var template = '<ul>   ' +
            '<% _.each(transactions, function(transaction) { %>' +
            '<li><pre><%= transaction.line %></pre></li>' +
            '<% }) %>' +
            '</ul>';

        var html = _.template(template, context);
        $('#filtered').html(html);
    }

    function renderTotalAmount(transactions) {
        var total = _.reduce(transactions, function(memo, t) {
            return memo + t.amount;
        }, 0);

        $('#total').text(total.toFixed(2) + ' ' + config.currencies[config.currency]);
    }

    function getFilters() {
        return {
            words: _.str.words($('#filter-words').val()),
            caseSensitive: false,
            minAmount: -Infinity,
            maxAmount: Infinity,
            minDate: moment('1970-01-01'),
            maxDate: moment()
        };
    }

    function main() {
        var transactionBox = $("#transaction-box");
        var textChanges = transactionBox.asEventStream("input propertychange");
        var filterWordChanges = $("#filter-words").asEventStream("input propertychange");

        var allChanges = Bacon.mergeAll(textChanges, filterWordChanges);

        // 300 ms after last change of anything, re-render info
        allChanges.debounce(300).onValue(function(e) {
            render(transactionBox.val(), getFilters());
        });

        // Initial render if the form happens to remember some values
        render(transactionBox.val(), getFilters());
    }

    main();
});