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
    function isLineTransaction(line) {
        const [date] = line.split('\t');
        return moment(date, 'DD.MM.YYYY').isValid();
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
            line: words.slice(2).join(' ')
        };
    }

    parseTransactions = text => text
        .split('\n')
        .filter(isLineTransaction)
        .map(parseTransactionLine);

    return {parseTransactions};
}(jQuery, _, moment);

$(function () {
    var Bank = Nordea;
    var config = Config;

    function filterTransaction(transaction, filters) {
        var line = filters.caseSensitive ? transaction.line : transaction.line.toLowerCase();
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

    function render(transactions, filters) {
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

    function getFilters(words) {
        return {
            words: _.str.words(words),
            caseSensitive: false,
            minAmount: -Infinity,
            maxAmount: Infinity,
            minDate: moment('1970-01-01'),
            maxDate: moment()
        };
    }

    function main() {
        const file = $('#file')
            .asEventStream('change')
            .flatMap(event => {
                const reader = new FileReader();
                reader.readAsText(event.target.files[0]);
                return Bacon.fromEventTarget(reader, 'load');
            })
            .map(event => event.target.result)
            .map(Bank.parseTransactions)
            .toProperty('');
        const searchTerm = $('#filter-words')
            .asEventStream('keyup')
            .debounce(200)
            .map(event => event.target.value)
            .toProperty('');

        const and = (searchTermValue, fileContents) => ({searchTermValue, fileContents});
        const renderResults = searchTerm.combine(file, and);

        renderResults.onValue(({fileContents, searchTermValue}) => {
            render(fileContents, getFilters(searchTermValue));
        });
    }

    main();
});