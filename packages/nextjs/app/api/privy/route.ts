import { NextResponse } from "next/server";
import { type AuthorizationContext, PrivyClient } from "@privy-io/node";

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID || "",
  appSecret: process.env.PRIVY_APP_SECRET || "",
});

// Build your authorization context per step (1) above
const authorizationContext: AuthorizationContext = {
  authorization_private_keys: [process.env.PRIVY_APP_AUTH_SECRET || ""],
};

// Pass the authorization context to the SDK method as the `authorization_context` parameter
const response = await privy
  .wallets()
  .ethereum()
  .signMessage(process.env.PRIVY_WALLET_ID || "", {
    message: "Hello, world! )",
    authorization_context: authorizationContext,
  });

export async function GET() {
  return NextResponse.json(response);
}

//TODO
//Replace with generateAuthorizationSignature
//as per the documentation:
// https://docs.privy.io/controls/authorization-keys/using-owners/sign/utility-functions#2-sign-your-request
// https://docs.privy.io/api-reference/authorization-signatures
