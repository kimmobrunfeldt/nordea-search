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
        const [
            logDate,
            valueDate,
            paymentDate,
            amount,
            receiver,
        ] = line.split('\t');

        return {
            date: moment(paymentDate, 'DD.MM.YYYY'),
            amount: parseFloat(amount.replace(',', '.')),
            receiver,
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

let fileData;
document.getElementById('file').onchange = function() {
  const file = this.files[0];

  const reader = new FileReader();
  reader.onload = function() {
    fileData = this.result;
  };
  reader.readAsText(file);
};

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
        const template =
            '<% _.each(transactions, function(transaction) { %>' +
            '<li class="transaction-item">' +
                '<div class="transaction-item__left">' + 
                    '<h4 class="transaction-item__receiver"><%= transaction.receiver %></h4>' + 
                    '<time class="transaction-item__date"><%= moment(transaction.date).format("LL") %></time>' + 
                '</div>' +
                '<strong><%= transaction.amount.toFixed(2) %></strong>' + 
            '<% }) %>';

        const html = _.template(template, {transactions});
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
        const fileChange = $('#file').asEventStream("change");
        var filterWordChanges = $("#filter-words").asEventStream("input propertychange");
        var allChanges = Bacon.mergeAll(fileChange, filterWordChanges);

        allChanges.debounce(300).onValue(function(e) {
            render(fileData, getFilters());
        });
    }

    main();
});