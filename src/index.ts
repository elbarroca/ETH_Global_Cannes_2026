import "dotenv/config";

console.log("VaultMind booting...");

async function main() {
  console.log("VaultMind ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Boot failed:", err);
  process.exit(1);
});
