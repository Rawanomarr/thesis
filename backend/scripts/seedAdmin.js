require("dotenv").config();

const bcrypt = require("bcryptjs");
const connectDB = require("../src/config/db");
const { Admin } = require("../src/models");
const { SALT_ROUNDS } = require("../src/controllers/authController");

const seedAdmin = async () => {
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.error("Set SEED_ADMIN_PASSWORD in .env before seeding");
    process.exit(1);
  }

  await connectDB();

  const existing = await Admin.findOne({ username: username.toLowerCase() });

  if (existing) {
    console.log(`Admin "${username}" already exists — skipping`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await Admin.create({
    username: username.toLowerCase(),
    passwordHash,
    role: "admin",
    experimentIds: [],
  });

  console.log(`Admin "${username}" created successfully`);
  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
