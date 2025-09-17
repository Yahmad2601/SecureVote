import "dotenv/config";
import { storage } from "../storage";
import { hashPassword, isPasswordHash } from "../auth/password";
import { closeDb } from "../db";

function toBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function ensureAdminUser() {
  const username = process.env.DEFAULT_ADMIN_USERNAME?.trim() || "admin";
  const fullName = process.env.DEFAULT_ADMIN_FULL_NAME?.trim() || "System Administrator";
  const passwordValue = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!passwordValue) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be defined before running the seed script.");
  }

  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) {
    if (!isPasswordHash(existingUser.password)) {
      console.warn(`Admin user \"${username}\" exists but password is not hashed. Please reset the password manually.`);
    }
    console.log(`Admin user \"${username}\" already exists. Skipping creation.`);
    return;
  }

  const password = isPasswordHash(passwordValue)
    ? passwordValue
    : await hashPassword(passwordValue);

  await storage.createUser({
    username,
    password,
    role: "super_admin",
    fullName,
  });

  console.log(`Admin user \"${username}\" created.`);
}

async function seedSampleData() {
  const shouldSeed = toBoolean(process.env.SEED_SAMPLE_DATA);
  if (!shouldSeed) {
    console.log("Sample data seeding disabled. Set SEED_SAMPLE_DATA=true to enable.");
    return;
  }

  const candidates = await storage.getCandidates();
  if (candidates.length === 0) {
    await storage.createCandidate({ name: "Candidate Alpha", party: "Democratic Party", position: 1 });
    await storage.createCandidate({ name: "Candidate Beta", party: "Republican Party", position: 2 });
    await storage.createCandidate({ name: "Candidate Gamma", party: "Independent", position: 3 });
    console.log("Seeded sample candidates.");
  } else {
    console.log("Candidates already exist. Skipping candidate seeding.");
  }

  const devices = await storage.getDevices();
  if (devices.length === 0) {
    await storage.createDevice({ deviceId: "machine_01", name: "Device-01", status: "online", batteryLevel: 87, location: "Building A" });
    await storage.createDevice({ deviceId: "machine_02", name: "Device-02", status: "online", batteryLevel: 92, location: "Building B" });
    await storage.createDevice({ deviceId: "machine_03", name: "Device-03", status: "warning", batteryLevel: 15, location: "Building C" });
    await storage.createDevice({ deviceId: "machine_04", name: "Device-04", status: "offline", batteryLevel: 0, location: "Building D" });
    await storage.createDevice({ deviceId: "machine_05", name: "Device-05", status: "online", batteryLevel: 76, location: "Building E" });
    console.log("Seeded sample devices.");
  } else {
    console.log("Devices already exist. Skipping device seeding.");
  }
}

async function main() {
  try {
    await ensureAdminUser();
    await seedSampleData();
    console.log("Database seed completed.");
  } finally {
    await closeDb();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  });
