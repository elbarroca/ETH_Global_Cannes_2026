"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InfrastructurePage() {
  const router = useRouter();
  useEffect(() => router.replace("/verify"), [router]);
  return <main><p role="status" className="sr-only">Opening protected proof.</p></main>;
}
