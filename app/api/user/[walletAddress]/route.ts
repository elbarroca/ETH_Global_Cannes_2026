import { NextRequest, NextResponse } from "next/server";
import { getUserByWallet } from "@/src/store/user-store";
import type { UserRecord } from "@/src/types/index";

function sanitizeUser(user: UserRecord) {
  const { proxyWallet, ...rest } = user;
  return { ...rest, proxyWallet: { address: proxyWallet.address }, proxyWalletAddress: proxyWallet.address };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> },
) {
  try {
    const { walletAddress } = await params;
    const user = await getUserByWallet(walletAddress);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(sanitizeUser(user));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
