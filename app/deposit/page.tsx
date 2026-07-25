"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DepositPage() {
  const router = useRouter();
  useEffect(() => router.replace("/dashboard"), [router]);
  return <main><p role="status" className="sr-only">Opening protected workspace.</p></main>;
}
