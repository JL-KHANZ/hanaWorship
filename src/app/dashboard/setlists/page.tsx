"use client";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./setlists.module.css";

export default function SetlistsPage() {
    const { user } = useAuth();
    const [setlists, setSetlists] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        // Simple query: get setlists owned by user
        // Note: requires composite index if using orderBy with where. 
        // I'll skip orderBy for now to avoid waiting for index creation, or sort client side.
        const q = query(
            collection(db, "setlists"),
            where("setOwner", "==", user.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            // Client side sort
            data.sort((a, b) => new Date(b.setTargetDate).getTime() - new Date(a.setTargetDate).getTime());
            setSetlists(data);
        });
        return () => unsub();
    }, [user]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className="text-3xl font-bold">내 콘티</h1>
                <Link href="/dashboard/setlists/new" className={styles.createBtn}>+ 새 콘티 만들기</Link>
            </div>

            <div className={styles.listGrid}>
                {setlists.length === 0 && (
                    <div className="col-span-full text-center p-12 opacity-50 border-2 border-dashed border-[var(--surface-border)] rounded-xl">
                        <p>아직 콘티가 없습니다. 새로운 콘티를 만들어보세요!</p>
                    </div>
                )}

                {setlists.map(set => (
                    <Link key={set.id} href={`/dashboard/setlists/${set.id}`} className={styles.setlistCard}>
                        <div>
                            <span className={styles.setDate}>
                                {new Date(set.setTargetDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            <h3 className={styles.setName}>{set.name}</h3>

                            <div className={styles.songListPreview}>
                                {set.songs && set.songs.length > 0 ? (
                                    set.songs.map((song: any, idx: number) => (
                                        <div key={idx} className={styles.songPreviewItem}>
                                            <span className={styles.songNumber}>{idx + 1}.</span> {song.songName}
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles.noSongs}>곡 없음</div>
                                )}
                            </div>
                        </div>
                        <div className={styles.songCount}>
                            {set.songs?.length || 0} Songs
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
