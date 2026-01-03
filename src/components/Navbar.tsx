"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./Navbar.module.css";

export default function Navbar() {
    const { user, isManager } = useAuth();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    return (
        <nav className={styles.nav}>
            <div className={styles.container}>
                <Link href="/dashboard" className={`${styles.logo} premium-gradient`}>
                    하나워십
                </Link>

                {/* Desktop Menu */}
                <div className={styles.desktopMenu}>
                    <Link href="/dashboard" className={styles.link}>
                        라이브러리
                    </Link>
                    <Link href="/dashboard/setlists" className={styles.link}>
                        내 콘티
                    </Link>
                    <Link href="/dashboard/teams" className={styles.link}>
                        팀
                    </Link>
                    {isManager && (
                        <Link href="/manager" className={styles.managerLink}>
                            매니저 패널
                        </Link>
                    )}
                </div>

                <div className={styles.actions}>
                    {user?.email && (
                        <span className={styles.userEmail}>{user.email}</span>
                    )}
                    <button onClick={handleLogout} className={styles.signOutBtn}>
                        로그아웃
                    </button>
                </div>

                {/* Mobile Menu Toggle */}
                <button className={styles.mobileToggle} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    ☰
                </button>
            </div>

            {/* Mobile Menu - Simple Implementation */}
            {mobileMenuOpen && (
                <div className={styles.mobileMenu}>
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className={styles.mobileLink}>라이브러리</Link>
                    <Link href="/dashboard/setlists" onClick={() => setMobileMenuOpen(false)} className={styles.mobileLink}>내 콘티</Link>
                    <Link href="/dashboard/teams" onClick={() => setMobileMenuOpen(false)} className={styles.mobileLink}>팀</Link>
                    {isManager && (
                        <Link href="/manager" onClick={() => setMobileMenuOpen(false)} className={styles.managerLink}>매니저 패널</Link>
                    )}
                    {user?.email && (
                        <div className="text-sm opacity-50 px-2 pb-2 border-b border-[var(--surface-border)] mb-2">
                            {user.email}
                        </div>
                    )}
                    <button onClick={handleLogout} className={styles.logoutLink}>로그아웃</button>
                </div>
            )}
        </nav>
    );
}
