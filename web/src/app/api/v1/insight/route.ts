import { withPayment } from "@moneydevkit/nextjs/server";

/**
 * L402-gated endpoint: agents (or humans) pay per request in sats, no account.
 * Unpaid GET returns 402 + invoice + macaroon; retry with Authorization: L402 <credential>:<preimage>
 */
const handler = async () => {
  return Response.json({
    service: "agent-economy-demo",
    insight:
      "Micropayments on Lightning let agents pay per API call without cards, CAPTCHAs, or minimum fees—" +
      "the same flow your agent can automate end-to-end.",
    generatedAt: new Date().toISOString(),
  });
};

export const GET = withPayment(
  {
    amount: 10,
    currency: "SAT",
    expirySeconds: 900,
  },
  handler,
);
