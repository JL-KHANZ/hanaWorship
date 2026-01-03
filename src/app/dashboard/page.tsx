"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useState } from "react";

export default function Dashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [songs, setSongs] = useState<any[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);

    // Filter States
    const [searchTerm, setSearchTerm] = useState("");
    const [filterKey, setFilterKey] = useState("");
    const [filterCategory, setFilterCategory] = useState("");

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
                return;
            }

            const q = query(collection(db, "music_sheets"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSongs(data);
                setFilteredSongs(data);
                setFetching(false);
            });
            return () => unsubscribe();
        }
    }, [user, loading, router]);

    // Filtering Effect
    useEffect(() => {
        let results = songs;

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(s =>
                s.songName.toLowerCase().includes(lower) ||
                (s.songArtist && s.songArtist.toLowerCase().includes(lower))
            );
        }

        if (filterKey) {
            results = results.filter(s => s.songKey === filterKey);
        }

        if (filterCategory) {
            results = results.filter(s => {
                // songCategory is an array
                if (Array.isArray(s.songCategory)) {
                    return s.songCategory.includes(filterCategory);
                }
                return s.songCategory === filterCategory;
            });
        }

        setFilteredSongs(results);
    }, [searchTerm, filterKey, filterCategory, songs]);

    if (loading || !user) return null;

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>악보 라이브러리</h1>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <input
                    type="text"
                    placeholder="곡 제목 또는 아티스트 검색..."
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                    className={styles.filterSelect}
                    value={filterKey}
                    onChange={e => setFilterKey(e.target.value)}
                >
                    <option value="">모든 키 (Key)</option>
                    {["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => (
                        <option key={k} value={k}>{k}</option>
                    ))}
                </select>
                <select
                    className={styles.filterSelect}
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                >
                    <option value="">모든 카테고리</option>
                    <option value="상향">상향</option>
                    <option value="외향">외향</option>
                    <option value="내향">내향</option>
                </select>
            </div>

            <div className={styles.grid}>
                {filteredSongs.length === 0 && !fetching && (
                    <div className={styles.emptyState}>
                        <p>검색 결과가 없습니다.</p>
                    </div>
                )}

                {filteredSongs.map((song) => (
                    <div key={song.id} className={styles.songCard}>
                        {song.thumbnailUrl ? (
                            <img src={song.thumbnailUrl} className={styles.cardImage} loading="lazy" />
                        ) : (
                            <div className={styles.cardImage}></div>
                        )}
                        <div className={styles.cardContent}>
                            <h3 className={styles.songName} title={song.songName}>{song.songName}</h3>
                            <div className={styles.songMeta}>
                                <span>{song.songArtist || "Unknown Artist"}</span>
                                <span className={styles.keyBadge}>{song.songKey}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
