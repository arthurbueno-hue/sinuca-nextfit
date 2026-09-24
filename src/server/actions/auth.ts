"use server";

import { signIn, signOut } from "@/auth";
import { localTestLoginEnabled } from "../config";

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/" });
}

export async function devSignInAction(formData: FormData) {
  if (!localTestLoginEnabled()) return;
  await signIn("dev-login", { user: String(formData.get("user") ?? ""), redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
