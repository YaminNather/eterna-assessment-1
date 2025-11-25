import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const wallet = Keypair.generate();

console.log("Public Key:", wallet.publicKey.toBase58());
console.log("Secret Key (store in .env):", bs58.encode(wallet.secretKey));