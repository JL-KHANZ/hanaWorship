import { NextResponse } from "next/server";
import axios from "axios";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(new URL("/login?error=no_code", req.url));
    }

    try {
        const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
        const clientSecret = process.env.KAKAO_CLIENT_SECRET;
        const origin = new URL(req.url).origin;
        const redirectUri = `${origin}/api/auth/kakao/callback`;

        console.log("--- Kakao Login Debug ---");
        console.log("Origin:", origin);
        console.log("Redirect URI:", redirectUri);
        console.log("Client ID present:", !!clientId);
        console.log("Client Secret present:", !!clientSecret);

        // 1. Exchange code for token
        let tokenRes;
        try {
            tokenRes = await axios.post(
                "https://kauth.kakao.com/oauth/token",
                new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: clientId!,
                    client_secret: clientSecret || "",
                    redirect_uri: redirectUri,
                    code,
                }),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );
        } catch (e: any) {
            console.error("Token exchange failed:", e.response?.data || e.message);
            throw e;
        }

        const { access_token } = tokenRes.data;
        console.log("Access token obtained");

        // 2. Get User Info
        let userRes;
        try {
            userRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
                headers: { Authorization: `Bearer ${access_token}` },
            });
        } catch (e: any) {
            console.error("User info retrieval failed:", e.response?.data || e.message);
            throw e;
        }

        const kakaoUser = userRes.data;
        const uid = `kakao:${kakaoUser.id}`;
        const email = kakaoUser.kakao_account?.email || `${kakaoUser.id}@kakao.com`;
        const displayName = kakaoUser.properties?.nickname || "Kakao User";
        console.log("Kakao user info:", { uid, email, displayName });

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();
        console.log("Firebase Admin services obtained");

        // 3. Create or update user in Firebase
        try {
            await adminAuth.getUser(uid);
            console.log("Existing user found in Firebase Auth");
        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
                console.log("Creating new user in Firebase Auth");
                await adminAuth.createUser({
                    uid,
                    email,
                    displayName,
                });
                // Initial user doc in Firestore
                await adminDb.collection("users").doc(uid).set({
                    email,
                    displayName,
                    role: "user",
                    createdAt: new Date().toISOString(),
                    provider: "kakao"
                });
                console.log("New user doc created in Firestore");
            } else {
                console.error("Firebase getUser error:", error);
                throw error;
            }
        }

        // 4. Generate Custom Token
        const customToken = await adminAuth.createCustomToken(uid);
        console.log("Custom token generated successfully");

        // 5. Redirect back to login with token
        return NextResponse.redirect(new URL(`/login?token=${customToken}`, req.url));

    } catch (error: any) {
        console.error("Kakao Login Error Final Catch:", error.response?.data || error.message);
        return NextResponse.redirect(new URL(`/login?error=kakao_failed`, req.url));
    }
}
