import { NextResponse } from "next/server";

export async function GET() {
  try {
    const resp = await fetch(
      "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=1",
      { next: { revalidate: 10 } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const price = Number(data.outAmount) / 1e6;
      return NextResponse.json({ price, time: Date.now() });
    }
    return NextResponse.json({ price: null, error: "Quote failed" });
  } catch (e) {
    return NextResponse.json({ price: null, error: e.message });
  }
}
