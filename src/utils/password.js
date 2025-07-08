import crypto from "crypto";

const SALT_LENGTH = 16; // 128 bits
const ITERATIONS = 100000;
const KEY_LENGTH = 64; // 512 bits
const DIGEST = "sha512";

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex");

  return {
    salt,
    hash,
  };
}

function verifyPassword(password, salt, hash) {
  const hashToVerify = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex");

  return hashToVerify === hash;
}

export { hashPassword, verifyPassword };