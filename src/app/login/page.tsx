"use client";
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [managerCode, setManagerCode] = useState(""); // Simple protection for manager role
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
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
                            placeholder="••••••••"
                        />
                    </div>

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
