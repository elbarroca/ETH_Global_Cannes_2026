import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("wallet UI uses the single native injected connector without the removed stack", async () => {
  const [provider, button, environment, packageSource] = await Promise.all([
    readFile(`${root}/contexts/wagmi-provider.tsx`, "utf8"),
    readFile(`${root}/components/wallet-connect.tsx`, "utf8"),
    readFile(`${root}/.env.example`, "utf8"),
    readFile(`${root}/package.json`, "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource) as {
    dependencies?: Record<string, string>;
  };

  assert.equal(provider.match(/injected\(\{ shimDisconnect: true \}\)/g)?.length, 1);
  assert.doesNotMatch(`${provider}\n${button}`, /@dynamic-labs|DynamicWagmi|DynamicContext/);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_(?:DYNAMIC|WALLETCONNECT)/);
  for (const dependency of [
    "@dynamic-labs/ethereum",
    "@dynamic-labs/sdk-react-core",
    "@dynamic-labs/wagmi-connector",
    "@rainbow-me/rainbowkit",
    "@walletconnect/ethereum-provider",
  ]) {
    assert.equal(packageJson.dependencies?.[dependency], undefined, dependency);
  }
  assert.match(button, /Connect Wallet/);
  assert.match(button, /Disconnect wallet/);
});
