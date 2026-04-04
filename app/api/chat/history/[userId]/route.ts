import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const prisma = getPrisma();

    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
