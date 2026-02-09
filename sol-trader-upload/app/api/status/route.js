import { NextResponse } from "next/server";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { kv } from "@vercel/kv";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export async function GET() {
  try {
    // Wallet balance
    let wallet = { address: "not configured", sol: 0, usdc: 0 };
    if (process.env.PRIVATE_KEY) {
      try {
        const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
        const kp = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
        const solBal = await conn.getBalance(kp.publicKey);
        wallet = { address: kp.publicKey.toBase58(), sol: solBal / LAMPORTS_PER_SOL, usdc: 0 };
        // Try USDC balance
        try {
          const { getAccount, getAssociatedTokenAddress } = await import("@solana/spl-token");
          const ata = await getAssociatedTokenAddress(USDC_MINT, kp.publicKey);
          const acct = await getAccount(conn, ata);
          wallet.usdc = Number(acct.amount) / 1e6;
        } catch {}
      } catch (e) {
        wallet.error = e.message;
      }
    }

    // Trades from KV
    const trades = (await kv.get("sol-trader-trades")) || [];

    // Config
    const config = {
      strategy: process.env.STRATEGY || "dca",
      trade_size: (process.env.TRADE_AMOUNT_SOL || "0.01") + " SOL",
      slippage: (process.env.SLIPPAGE_BPS || "50") + " bps",
      max_daily: process.env.MAX_DAILY_TRADES || "20",
      dry_run: process.env.DRY_RUN !== "false" ? "YES" : "NO",
    };

    // Daily stats
    const today = new Date().toISOString().split("T")[0];
    const todayTrades = trades.filter(t => t.time?.startsWith(today));

    return NextResponse.json({
      wallet,
      trades: trades.slice(-50).reverse(),
      config,
      stats: {
        totalTrades: trades.length,
        todayTrades: todayTrades.length,
        maxDaily: parseInt(process.env.MAX_DAILY_TRADES || "20"),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
