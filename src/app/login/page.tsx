"use client";
import { useState, useEffect, Suspense } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken } from "firebase/auth";
import { RiKakaoTalkFill } from "react-icons/ri";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [managerCode, setManagerCode] = useState(""); // Simple protection for manager role
    const router = useRouter();
    const searchParams = useSearchParams();

    // Handle Custom Token from Kakao redirect
    useEffect(() => {
        const token = searchParams.get("token");
        const kakaoError = searchParams.get("error");

        if (token) {
            const loginWithToken = async () => {
                try {
                    await signInWithCustomToken(auth, token);
                    router.push("/dashboard");
                } catch (err: any) {
                    setError("카카오 로그인 토큰 인증 실패: " + err.message);
                }
            };
            loginWithToken();
        } else if (kakaoError) {
            setError(kakaoError === "kakao_failed" ? "카카오 로그인에 실패했습니다." : "카카오 인증 정보가 올바르지 않습니다.");
        }
    }, [searchParams, router]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (password.length < 6) {
                    setError("비밀번호는 6자리 이상이어야 합니다.");
                    return;
                }
                if (password !== confirmPassword) {
                    setError("비밀번호가 일치하지 않습니다.");
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Check manager code
                const role = managerCode === "ADMIN123" ? "manager" : "user"; // Hardcoded for demo/MVP

                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    role: role,
                    createdAt: new Date().toISOString(),
                });
            }
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "An error occurred");
        }
    };

    const handleKakaoLogin = () => {
        // Redirect to Kakao OAuth
        const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
        const redirectUri = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}/api/auth/kakao/callback` : '';
        const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;

        if (!clientId) {
            alert("카카오 설정(NEXT_PUBLIC_KAKAO_CLIENT_ID)이 필요합니다.");
            return;
        }
        window.location.href = kakaoAuthUrl;
    };

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginForm
                isLogin={isLogin} setIsLogin={setIsLogin}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                error={error} setError={setError}
                managerCode={managerCode} setManagerCode={setManagerCode}
                handleAuth={handleAuth} handleKakaoLogin={handleKakaoLogin}
            />
        </Suspense>
    );
}

// Separate component to use useSearchParams
function LoginForm({
    isLogin, setIsLogin, email, setEmail, password, setPassword,
    confirmPassword, setConfirmPassword, error, setError,
    managerCode, setManagerCode, handleAuth, handleKakaoLogin
}: any) {
    return (
        <div className={styles.container}>
            <div className={`${styles.panel} glass-panel animate-fade-in`}>
                <h2 className={`${styles.title} premium-gradient`}>{isLogin ? "로그인" : "회원가입"}</h2>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleAuth} className={styles.form}>
                    <div className={styles.field}>
                        <label className={styles.label}>이메일</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>비밀번호</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            placeholder="6자리 이상 입력해주세요"
                        />
                    </div>

                    {!isLogin && (
                        <div className={styles.field}>
                            <label className={styles.label}>비밀번호 확인</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={styles.input}
                                placeholder="6자리 이상 입력해주세요"
                            />
                        </div>
                    )}

                    {!isLogin && (
                        <div className={styles.managerSection}>
                            <label className={styles.managerLabel}>매니저 액세스 코드 (선택사항)</label>
                            <input
                                type="text"
                                value={managerCode}
                                onChange={(e) => setManagerCode(e.target.value)}
                                className={styles.input}
                            // placeholder="매니저 권한 코드 (ADMIN123) 입력"
                            />
                        </div>
                    )}

                    <button type="submit" className={styles.submitButton}>
                        {isLogin ? "로그인" : "회원가입"}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>또는</span>
                </div>

                <button onClick={handleKakaoLogin} className={styles.kakaoButton}>
                    <RiKakaoTalkFill className={styles.kakaoIcon} />
                    <span>카카오 로그인</span>
                </button>

                <div className={styles.toggleContainer}>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className={styles.toggleButton}
                    >
                        {isLogin ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
                    </button>
                </div>
            </div>
            <div className={styles.background}>
                <div className={styles.blob1}></div>
                <div className={styles.blob2}></div>
            </div>
        </div>
    );
}
