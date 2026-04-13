import CryptoJS from "crypto-js";
import { config } from "../config";

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, config.tokenEncryptionKey).toString();
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, config.tokenEncryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}
