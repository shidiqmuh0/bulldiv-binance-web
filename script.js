document.getElementById('analyzeButton').addEventListener('click', async () => {
    const timeframe = document.getElementById('timeframe').value;
    const symbolsList = document.getElementById('symbolsList');
    symbolsList.innerHTML = '';

    // Show loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const loadingText = document.createElement('p');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Loading...';

    symbolsList.appendChild(spinner);
    symbolsList.appendChild(loadingText);

    try {
        const exchange = new ccxt.binance();
        const markets = await exchange.loadMarkets();
        const symbols = Object.keys(markets).filter(symbol => symbol.endsWith('/USDT'));

        for (const symbol of symbols) {
            try {
                const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, 500);
                const df = ohlcv.map(ohlcv => ({
                    timestamp: new Date(ohlcv[0]),
                    open: ohlcv[1],
                    high: ohlcv[2],
                    low: ohlcv[3],
                    close: ohlcv[4],
                    volume: ohlcv[5],
                }));

                const closes = df.map(d => d.close);
                const macd = calculateMACD(closes);
                const rsi = calculateRSI(closes);

                if (detectBullishDivergence(macd, rsi, closes)) {
                    const li = document.createElement('li');
                    li.textContent = symbol;
                    symbolsList.appendChild(li);
                }
            } catch (error) {
                console.error(`Could not analyze ${symbol}:`, error);
            }
        }

        // Remove loading spinner and text after processing
        symbolsList.removeChild(spinner);
        symbolsList.removeChild(loadingText);

    } catch (error) {
        console.error('Error loading markets:', error);
        // Optionally handle error display here
        symbolsList.innerHTML = '<p>Error loading data. Please try again.</p>';
    }
});

function calculateMACD(closes) {
    const shortEMA = calculateEMA(closes, 12);
    const longEMA = calculateEMA(closes, 26);
    const macd = shortEMA.map((val, idx) => val - longEMA[idx]);
    const signal = calculateEMA(macd.slice(26), 9);
    const histogram = macd.slice(26).map((val, idx) => val - signal[idx]);
    return { macd: macd.slice(26), signal, histogram };
}

function calculateEMA(data, window) {
    const k = 2 / (window + 1);
    const emaArray = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
}

function calculateRSI(closes, period = 14) {
    const gains = [];
    const losses = [];
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) {
            gains.push(diff);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(-diff);
        }
    }
    const avgGain = average(gains.slice(0, period));
    const avgLoss = average(losses.slice(0, period));
    const rs = avgGain / avgLoss;
    const rsiArray = [100 - 100 / (1 + rs)];

    for (let i = period; i < gains.length; i++) {
        const gain = gains[i];
        const loss = losses[i];
        const newAvgGain = (avgGain * (period - 1) + gain) / period;
        const newAvgLoss = (avgLoss * (period - 1) + loss) / period;
        const newRS = newAvgGain / newAvgLoss;
        rsiArray.push(100 - 100 / (1 + newRS));
    }
    return rsiArray;
}

function average(data) {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

function detectBullishDivergence(macd, rsi, closes) {
    const macdLows = macd.histogram.filter(value => value < 0);
    const priceLows = closes.slice(-macdLows.length).filter((close, index) => macd.histogram[index] < 0);

    const bullishDivergenceMACD = macdLows.length >= 2 &&
        priceLows[priceLows.length - 1] > priceLows[priceLows.length - 2] &&
        macdLows[macdLows.length - 1] < macdLows[macdLows.length - 2];

    const rsiLows = rsi.filter(value => value < 30);
    const bullishDivergenceRSI = rsiLows.length >= 2 &&
        closes[closes.length - 1] > closes[closes.length - rsiLows.length] &&
        rsiLows[rsiLows.length - 1] < rsiLows[rsiLows.length - 2];

    return bullishDivergenceMACD && bullishDivergenceRSI;
}
