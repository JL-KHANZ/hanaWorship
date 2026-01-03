"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <main className={styles.main}>
      <div className={`${styles.content} animate-fade-in`}>
        <h1 className={`${styles.title} premium-gradient`}>
          하나워십
        </h1>
        <p className={styles.subtitle}>
          예배를 위한 모든 준비를 한번에. <br /> 현대적인 워십 팀을 위한 프리미엄 도구.
        </p>

        <div className="flex gap-4 mt-8">
          <Link href="/login" className={`${styles.ctaButton} glass-panel`}>
            시작하기
          </Link>
        </div>
      </div>

      <div className={styles.backgroundDecor}>
        <div className={styles.blob1}></div>
        <div className={styles.blob2}></div>
      </div>
    </main>
  );
}
