import type { AgentLifecycleVersion, ProtectedPublishedAgent } from "@/lib/api";

// Serializes an agent's capability manifest to human-readable YAML for judge
// and buyer review. This is display-only — manifests are stored as JSON in
// Prisma. The YAML output binds the exact immutable manifestHash so any drift
// between displayed text and stored manifest is detectable.
export function agentVersionToYaml(agent: AgentLifecycleVersion | ProtectedPublishedAgent): string {
  const lines: string[] = [
    `# AlphaDawg Agent Capability Manifest`,
    `# manifestHash: ${agent.manifestHash}`,
    ``,
    `schema_version: 2`,
    `name: ${yamlString(agent.name)}`,
    `version: ${agent.version}`,
    `adapter: ${agent.adapterKey}`,
    ``,
    `identity:`,
    `  owner_wallet: ${agent.ownerWallet}`,
  ];

  if ("fullSubname" in agent && agent.fullSubname) {
    lines.push(`  ens_subname: ${agent.fullSubname}`);
  }
  if ("creatorParent" in agent && agent.creatorParent) {
    lines.push(`  creator_parent: ${agent.creatorParent}`);
  }
  if ("agentLabel" in agent && agent.agentLabel) {
    lines.push(`  agent_label: ${agent.agentLabel}`);
  }
  if ("canonicalState" in agent) {
    lines.push(`  canonical_state: ${agent.canonicalState}`);
  }
  if ("authorityOwner" in agent && agent.authorityOwner) {
    lines.push(`  authority_owner: ${agent.authorityOwner}`);
  }
  if ("authorityDelegate" in agent && agent.authorityDelegate) {
    lines.push(`  authority_delegate: ${agent.authorityDelegate}`);
  }
  if ("authorityReleaseSha" in agent && agent.authorityReleaseSha) {
    lines.push(`  authority_release_sha: ${agent.authorityReleaseSha}`);
  }
  if ("writePlanHash" in agent && agent.writePlanHash) {
    lines.push(`  write_plan_hash: ${agent.writePlanHash}`);
  }

  lines.push(``);
  lines.push(`capabilities:`);
  for (const cap of agent.capabilities) {
    lines.push(`  - ${cap}`);
  }

  lines.push(``);
  lines.push(`reviewed_skills:`);
  for (const cap of agent.capabilities) {
    lines.push(`  - ${cap}`);
  }
  lines.push(`native_connections:`);
  lines.push(`  - zero-g-compute`);
  lines.push(`  - zero-g-storage`);
  lines.push(`mcp: []`);

  lines.push(``);
  lines.push(`commerce:`);
  lines.push(`  price_atomic: "${agent.priceAtomic}"`);
  lines.push(`  asset: ${agent.asset}`);
  lines.push(`  proof_policy: ${agent.proofPolicy}`);
  lines.push(`  payout_address: ${agent.ownerWallet}`);

  lines.push(``);
  lines.push(`hashes:`);
  lines.push(`  manifest: ${agent.manifestHash}`);
  lines.push(`  prompt: ${agent.promptHash}`);
  lines.push(`  config: ${agent.configHash}`);

  if (agent.publishedAt) {
    lines.push(``);
    lines.push(`published_at: ${agent.publishedAt}`);
  }

  return lines.join("\n");
}

function yamlString(value: string): string {
  if (/[:#\[\]{}|>&*!,'"?@`]/.test(value) || value.includes("\n")) {
    return JSON.stringify(value);
  }
  return value;
}
