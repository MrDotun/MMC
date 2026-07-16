import yfinance as yf
import pandas as pd
import numpy as np

print("Fetching EURUSD 1H data...")
df = yf.download('EURUSD=X', interval='1h', period='720d', progress=False)
df = df.dropna()

df['EMA_1200'] = df['Close'].ewm(span=1200, adjust=False).mean()
df['Daily_Uptrend'] = df['Close'] > df['EMA_1200']
df['Daily_Downtrend'] = df['Close'] < df['EMA_1200']

df['High-Low'] = df['High'] - df['Low']
df['High-PrevClose'] = abs(df['High'] - df['Close'].shift(1))
df['Low-PrevClose'] = abs(df['Low'] - df['Close'].shift(1))
df['TrueRange'] = df[['High-Low', 'High-PrevClose', 'Low-PrevClose']].max(axis=1)
df['ATR'] = df['TrueRange'].rolling(14).mean()
df['Body'] = abs(df['Close'] - df['Open'])

df['Bull_Surge'] = (df['Close'] > df['Open']) & (df['Body'] > (df['ATR'] * 1.5))
df['Bear_Surge'] = (df['Open'] > df['Close']) & (df['Body'] > (df['ATR'] * 1.5))
df['EMA_9'] = df['Close'].ewm(span=9, adjust=False).mean()

wins = 0
losses = 0

for i in range(14, len(df) - 10):
    if df['Daily_Uptrend'].iloc[i]:
        recent_bull_surge = df['Bull_Surge'].iloc[i-3:i].any()
        retracement = (df['Low'].iloc[i] <= df['EMA_9'].iloc[i]) and (df['Close'].iloc[i] > df['Open'].iloc[i])
        if recent_bull_surge and retracement:
            entry_price = df['Close'].iloc[i]
            stop_loss = entry_price - (df['ATR'].iloc[i] * 1.5)
            take_profit = entry_price + (df['ATR'].iloc[i] * 3.0) 
            for j in range(1, 11):
                if (i+j) < len(df):
                    if df['Low'].iloc[i+j] <= stop_loss:
                        losses += 1
                        break
                    elif df['High'].iloc[i+j] >= take_profit:
                        wins += 1
                        break
    elif df['Daily_Downtrend'].iloc[i]:
        recent_bear_surge = df['Bear_Surge'].iloc[i-3:i].any()
        retracement = (df['High'].iloc[i] >= df['EMA_9'].iloc[i]) and (df['Close'].iloc[i] < df['Open'].iloc[i])
        if recent_bear_surge and retracement:
            entry_price = df['Close'].iloc[i]
            stop_loss = entry_price + (df['ATR'].iloc[i] * 1.5)
            take_profit = entry_price - (df['ATR'].iloc[i] * 3.0) 
            for j in range(1, 11):
                if (i+j) < len(df):
                    if df['High'].iloc[i+j] >= stop_loss:
                        losses += 1
                        break
                    elif df['Low'].iloc[i+j] <= take_profit:
                        wins += 1
                        break

print("\n--- RESULTS ---")
total = wins + losses
if total > 0:
    print(f"Trades: {total} | Wins: {wins} | Losses: {losses}")
    print(f"Win Rate: {(wins/total)*100:.2f}%")
else:
    print("No trades found.")
