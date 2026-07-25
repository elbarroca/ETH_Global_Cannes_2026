"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { KernelJobDetail } from "@/components/kernel-job-detail";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ComputePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const protectedJob = UUID_PATTERN.test(id);

  useEffect(() => {
    if (!protectedJob) router.replace("/dashboard");
  }, [protectedJob, router]);

  if (!protectedJob) return <main><p role="status" className="sr-only">Opening protected workspace.</p></main>;
  return <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8"><KernelJobDetail jobId={id} /></main>;
}
