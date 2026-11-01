import { saleFigures } from "@/lib/calc";
import { dataErrorResponse } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

const CASH_KEYS = [
  "salePrice",
  "payoff",
  "extraCash",
  "closingPct",
  "keepCash",
  "listingAgentPct",
  "buyerAgentPct",
  "otherSellingFees",
  "basisPaid",
  "basisImprovements",
] as const;

export async function GET(request: Request) {
  try {
    const { store } = await boardContext(request);
    return Response.json(await store.assumptions.get());
  } catch (error) {
    return dataErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { board, store } = await boardContext(request);
    if (body.boardId && body.boardId !== board.id) {
      return Response.json(await store.assumptions.get());
    }
    const before = await store.assumptions.get();
    const assumptions = await store.assumptions.update(body);
    const cashChanged = CASH_KEYS.some((key) => Number(before[key]) !== Number(assumptions[key]));
    if (cashChanged) {
      const { cashAvailable } = saleFigures(assumptions);
      await store.assumptions.applyCashToDownPayments(cashAvailable, assumptions.closingPct);
    }
    return Response.json(assumptions);
  } catch (error) {
    return dataErrorResponse(error);
  }
}
