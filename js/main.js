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

const Op = function(moment) {
    function isLineTransaction(line) {
        const [date] = line.split(';');
        return moment(date, 'DD.MM.YYYY').isValid();
    }

    function parseTransactionLine(line) {
        const [,
            paymentDate,
            amount,
            , ,
            receiver,
        ] = line.split(';');

        return {
            date: moment(paymentDate, 'DD.MM.YYYY'),
            amount: parseFloat(amount.replace(',', '.')),
            receiver,
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

    const isBetween = (min, max) => transaction =>
        transaction.amount >= min && transaction.amount <= max;

    const includesSomeSearchTerm = searchTerms => transaction => {
        return searchTerms.length ? searchTerms.some(searchTerm => {
            return transaction.receiver.toLowerCase().includes(searchTerm.toLowerCase());
        }) : true;
    };

    function render(transactions) {
        renderTransactionList(transactions);
        renderTotalAmount(transactions);
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
        const total = transactions.reduce((memo, t) => memo + t.amount, 0);
        $('#total').text(total.toFixed(2) + ' ' + config.currencies[config.currency]);
    }

    function getFilters(words) {
        return {
            searchTerms: words.split(' '),
            caseSensitive: false,
            minAmount: -Infinity,
            maxAmount: Infinity,
            minDate: moment('1970-01-01'),
            maxDate: moment()
        };
    }

    function main() {
        const bankRadioButton = $('[name="bank"]')
            .asEventStream('change')
            .map(event => event.target.value)
            .toProperty('nordea');
        const file = $('#file')
            .asEventStream('change')
            .flatMap(event => {
                const reader = new FileReader();
                reader.readAsText(event.target.files[0]);
                return Bacon.fromEventTarget(reader, 'load');
            })
            .map(event => event.target.result)
            .combine(bankRadioButton, (fileValue, bankRadio) => {
                if (bankRadio === 'nordea') {
                    return Nordea.parseTransactions(fileValue)
                }
                else if (bankRadio === 'op') {
                    return Op.parseTransactions(fileValue)
                }
                return [];
            });
        const searchTerm = $('#filter-words')
            .asEventStream('keyup')
            .debounce(200)
            .map(event => event.target.value)
            .toProperty('');
        

        Bacon.combineWith((transactions, searchTermValue) => {
            const filters = getFilters(searchTermValue);
            return transactions
                .filter(includesSomeSearchTerm(filters.searchTerms))
                .filter(isBetween(filters.minDate, filters.maxDate))
                .filter(isBetween(filters.minAmount, filters.maxAmount));
        }, file, searchTerm)
            .onValue(render);
    }

    main();
});