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

const Nordea = function(moment) {
    function isLineTransaction(line) {
        const [date] = line.split('\t');
        return moment(date, 'DD.MM.YYYY').isValid();
    }

    function parseTransactionLine(line) {
        const [, ,
            paymentDate,
            amount,
            receiver,
            , ,
            paymentType,
        ] = line.split('\t');

        return {
            date: moment(paymentDate, 'DD.MM.YYYY'),
            amount: parseFloat(amount.replace(',', '.')),
            receiver: paymentType.includes('otto') ? paymentType : receiver,
        };
    }

    parseTransactions = text => text
        .split('\n')
        .filter(isLineTransaction)
        .map(parseTransactionLine);

    return {parseTransactions};
}(moment);

$(function () {
    var Bank = Nordea;
    var config = Config;

    const isDateInBoundaries = filters => transaction => {
        return (transaction.date >= filters.minDate) &&
               (transaction.date <= filters.maxDate);
    }

    const isAmountInBoundaries = filters => transaction => {
        return (transaction.amount >= filters.minAmount) &&
               (transaction.amount <= filters.maxAmount);
    }

    const includesSearchTerm = searchTerms => transaction => {
        return searchTerms.length ? searchTerms.some(searchTerm => {
            return transaction.receiver.toLowerCase().includes(searchTerm.toLowerCase());
        }) : true;
    };

    function render(transactions, filters) {
        const filteredTransactions = transactions
            .filter(includesSearchTerm(filters.searchTerms))
            .filter(isDateInBoundaries(filters))
            .filter(isAmountInBoundaries(filters))
            
        renderTransactionList(filteredTransactions);
        renderTotalAmount(filteredTransactions);
    }

    function renderTransactionList(transactions) {
        const template = transactions.reduce((acc, transaction) => {
            const amountClass = transaction.amount > 0 ? 'transaction-item__amount--income' : 'transaction-item__amount--expense';
            return acc + '<li class="transaction-item">' +
                '<div class="transaction-item__left">' + 
                    '<h4 class="transaction-item__receiver">' + transaction.receiver + '</h4>' + 
                    '<time class="transaction-item__date">' + moment(transaction.date).format("LL") + '</time>' + 
                '</div>' +
                '<strong class="' + amountClass + '">' + transaction.amount.toFixed(2) + '</strong>' + 
            '</li>';
        }, '');

        $('#filtered').html(template);
    }

    function renderTotalAmount(transactions) {
        var total = _.reduce(transactions, function(memo, t) {
            return memo + t.amount;
        }, 0);

        $('#total').text(total.toFixed(2) + ' ' + config.currencies[config.currency]);
    }

    function getFilters(words) {
        return {
            searchTerms: _.str.words(words),
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
            .toProperty([]);
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