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

                <div className={styles.menu}>
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
                            매니저
                        </Link>
                    )}


                    <div className={styles.actions}>
                        {user?.email && (
                            <span className={styles.userEmail}>{user.email}</span>
                        )}
                    </div>

                    <button onClick={handleLogout} className={styles.signOutBtn}>
                        ⎋
                    </button>
                </div>
            </div>

        </nav>
    );
}
