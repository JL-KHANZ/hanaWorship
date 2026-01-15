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
        const redirectUri = `${new URL(req.url).origin}/api/auth/kakao/callback`;

        // 1. Exchange code for token
        const tokenRes = await axios.post(
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

        const { access_token } = tokenRes.data;

        // 2. Get User Info
        const userRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const kakaoUser = userRes.data;
        const uid = `kakao:${kakaoUser.id}`;
        const email = kakaoUser.kakao_account?.email || `${kakaoUser.id}@kakao.com`;
        const displayName = kakaoUser.properties?.nickname || "Kakao User";

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();

        // 3. Create or update user in Firebase
        try {
            await adminAuth.getUser(uid);
        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
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
            }
        }

        // 4. Generate Custom Token
        const customToken = await adminAuth.createCustomToken(uid);

        // 5. Redirect back to login with token
        return NextResponse.redirect(new URL(`/login?token=${customToken}`, req.url));

    } catch (error: any) {
        console.error("Kakao Login Error:", error.response?.data || error.message);
        return NextResponse.redirect(new URL(`/login?error=kakao_failed`, req.url));
    }
}
