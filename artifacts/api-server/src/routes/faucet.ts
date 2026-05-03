import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALLOWED_NETWORKS = ["studionet", "localnet"];
const MAX_AMOUNT_HEX = "0x56BC75E2D63100000"; // 100 GEN in wei

router.post("/faucet", async (req, res) => {
  const rpc = process.env.GENLAYER_RPC;
  if (!rpc) {
    return res.status(503).json({
      error: "GENLAYER_RPC env var is not configured on the server.",
    });
  }

  const network = (process.env.GENLAYER_NETWORK || "studionet").toLowerCase();
  if (!ALLOWED_NETWORKS.includes(network)) {
    return res.status(403).json({
      error: "Faucet is only available on studionet and localnet.",
    });
  }

  const body = req.body || {};
  const address = body?.address;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid or missing address" });
  }

  const amount = body?.amount || MAX_AMOUNT_HEX;

  try {
    const upstream = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "debug_fundAccount",
        params: [address, amount],
      }),
    });

    const data = await upstream.json();

    if (data?.error) {
      const msg = data.error.message || JSON.stringify(data.error);
      return res.status(502).json({ error: `RPC error: ${msg}` });
    }

    return res.json({ result: data?.result ?? null });
  } catch (err: any) {
    return res.status(502).json({
      error: `Failed to reach GenLayer RPC: ${err?.message || "Unknown error"}`,
    });
  }
});

export default router;
