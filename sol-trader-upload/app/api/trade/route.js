import { NextResponse } from "next/server";
import { Connection, Keypair, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { kv } from "@vercel/kv";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPITER = "https://quote-api.jup.ag/v6";

export async function GET(request) {
  // Verify cron secret
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const strategy = process.env.STRATEGY || "dca";
  const tradeAmount = parseFloat(process.env.TRADE_AMOUNT_SOL || "0.01");
  const slippage = parseInt(process.env.SLIPPAGE_BPS || "50");
  const dryRun = process.env.DRY_RUN !== "false";
  const maxDaily = parseInt(process.env.MAX_DAILY_TRADES || "20");

  try {
    // Check daily limit
    const trades = (await kv.get("sol-trader-trades")) || [];
    const today = new Date().toISOString().split("T")[0];
    const todayTrades = trades.filter(t => t.time?.startsWith(today));
    if (todayTrades.length >= maxDaily) {
      return NextResponse.json({ action: "hold", reason: `Daily limit reached (${maxDaily})` });
    }

    // Get current price
    const amountLamports = Math.floor(tradeAmount * LAMPORTS_PER_SOL);
    const quoteResp = await fetch(
      `${JUPITER}/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${amountLamports}&slippageBps=${slippage}`
    );
    if (!quoteResp.ok) throw new Error("Quote failed");
    const quote = await quoteResp.json();
    const price = Number(quote.outAmount) / 1e6 / tradeAmount;

    // Get price history
    let priceHistory = (await kv.get("sol-trader-prices")) || [];
    priceHistory.push({ price, time: Date.now() });
    if (priceHistory.length > 300) priceHistory = priceHistory.slice(-300);
    await kv.set("sol-trader-prices", priceHistory);

    // Run strategy
    let action = "hold";
    let reason = "";

    if (strategy === "dca") {
      // DCA: buy every 3rd tick (every 15 minutes)
      const tickCount = priceHistory.length;
      if (tickCount % 3 === 0) {
        action = "buy";
        reason = `DCA buy #${Math.floor(tickCount / 3)} @ $${price.toFixed(2)}`;
      } else {
        reason = `DCA: ${3 - (tickCount % 3)} ticks until next buy`;
      }
    } else {
      // Momentum: SMA crossover
      if (priceHistory.length >= 20) {
        const prices = priceHistory.map(p => p.price);
        const sma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const prev = prices.slice(0, -1);
        const prevSma5 = prev.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const prevSma20 = prev.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, prev.length);

        if (prevSma5 <= prevSma20 && sma5 > sma20) {
          action = "buy";
          reason = `Golden cross: SMA5 ($${sma5.toFixed(2)}) > SMA20 ($${sma20.toFixed(2)})`;
        } else if (prevSma5 >= prevSma20 && sma5 < sma20) {
          action = "sell";
          reason = `Death cross: SMA5 < SMA20`;
        } else {
          reason = `Watching: SMA diff ${((sma5 - sma20) / sma20 * 100).toFixed(2)}%`;
        }
      } else {
        reason = `Collecting data (${priceHistory.length}/20)`;
      }
    }

    // Execute trade if signal
    let txSig = null;
    if (action !== "hold") {
      if (dryRun) {
        reason += " [DRY RUN]";
      } else if (process.env.PRIVATE_KEY) {
        try {
          const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
          const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

          // Get swap transaction
          const inputMint = action === "buy" ? SOL_MINT : USDC_MINT;
          const outputMint = action === "buy" ? USDC_MINT : SOL_MINT;
          const swapQuote = await fetch(`${JUPITER}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippage}`);
          const swapQuoteData = await swapQuote.json();

          const swapResp = await fetch(`${JUPITER}/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quoteResponse: swapQuoteData,
              userPublicKey: wallet.publicKey.toBase58(),
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: "auto",
            }),
          });
          const { swapTransaction } = await swapResp.json();
          const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
          tx.sign([wallet]);
          txSig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
          await conn.confirmTransaction(txSig, "confirmed");
        } catch (e) {
          reason += ` [SWAP ERROR: ${e.message}]`;
        }
      }

      // Log trade
      const trade = {
        time: new Date().toISOString(),
        action: action.toUpperCase(),
        amount: tradeAmount + " SOL",
        price: "$" + price.toFixed(4),
        tx: txSig || (dryRun ? "DRY_RUN" : "NO_KEY"),
        reason,
      };
      trades.push(trade);
      if (trades.length > 500) trades.splice(0, trades.length - 500);
      await kv.set("sol-trader-trades", trades);
    }

    return NextResponse.json({
      action,
      reason,
      price,
      tx: txSig,
      dryRun,
      todayTrades: todayTrades.length + (action !== "hold" ? 1 : 0),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const maxDuration = 30;
