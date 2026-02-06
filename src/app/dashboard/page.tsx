"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes, FaPen, FaSave, FaTrash, FaHistory, FaSearch, FaPlus, FaChevronDown } from "react-icons/fa";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import SongViewer from "./components/SongViewer";

export default function Dashboard() {
    const { user, loading, isManager } = useAuth();
    const router = useRouter();
    const [songs, setSongs] = useState<any[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);
    const [selectedSong, setSelectedSong] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        songName: "",
        songArtist: "",
        songKey: "",
        songLanguage: "",
        songCategory: ""
    });

    // Smart Home States
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [recentViewedIds, setRecentViewedIds] = useState<string[]>([]);

    useEffect(() => {
        const savedViewed = localStorage.getItem("recentViewedIds");
        const savedSearches = localStorage.getItem("recentSearches");
        if (savedViewed) setRecentViewedIds(JSON.parse(savedViewed));
        if (savedSearches) setRecentSearches(JSON.parse(savedSearches));
    }, []);

    const addToRecentViewed = (id: string) => {
        const updated = [id, ...recentViewedIds.filter(i => i !== id)].slice(0, 10);
        setRecentViewedIds(updated);
        localStorage.setItem("recentViewedIds", JSON.stringify(updated));
    };

    const addToRecentSearches = (term: string) => {
        if (!term || term.trim().length === 0) return;
        const updated = [term.trim(), ...recentSearches.filter(t => t !== term.trim())].slice(0, 8);
        setRecentSearches(updated);
        localStorage.setItem("recentSearches", JSON.stringify(updated));
    };

    const clearRecentSearch = (term: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = recentSearches.filter(t => t !== term);
        setRecentSearches(updated);
        localStorage.setItem("recentSearches", JSON.stringify(updated));
    };

    const startEditing = () => {
        if (!selectedSong) return;
        setEditForm({
            songName: selectedSong.songName || "",
            songArtist: selectedSong.songArtist || "",
            songKey: selectedSong.songKey || "",
            songLanguage: selectedSong.songLanguage || "한국어",
            songCategory: Array.isArray(selectedSong.songCategory) ? selectedSong.songCategory[0] : (selectedSong.songCategory || "상향")
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!selectedSong) return;
        try {
            const docRef = doc(db, "music_sheets", selectedSong.id);
            await updateDoc(docRef, {
                songName: editForm.songName,
                songArtist: editForm.songArtist,
                songKey: editForm.songKey,
                songLanguage: editForm.songLanguage,
                songCategory: [editForm.songCategory]
            });
            // Local update (optional, as snapshot listener will handle it)
            setSelectedSong({ ...selectedSong, ...editForm });
            setIsEditing(false);
        } catch (e) {
            console.error("Update failed", e);
            alert("수정 실패");
        }
    };

    const handleDelete = async () => {
        if (!selectedSong) return;
        if (!confirm(`'${selectedSong.songName}'을(를) 정말 삭제하시겠습니까?`)) return;

        try {
            // 1. Delete from ImageKit if imageIds exist
            if (selectedSong.imageIds && selectedSong.imageIds.length > 0) {
                await fetch("/api/imagekit/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileIds: selectedSong.imageIds })
                });
            }

            // 2. Delete from Firestore
            const docRef = doc(db, "music_sheets", selectedSong.id);
            await deleteDoc(docRef);

            // 3. Close Viewer
            setSelectedSong(null);
            setIsEditing(false);
            alert("삭제되었습니다.");
        } catch (e) {
            console.error("Delete failed", e);
            alert("삭제 실패");
        }
    };

    // Filter States
    const [searchTerm, setSearchTerm] = useState("");
    const [filterKey, setFilterKey] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [filterLanguage, setFilterLanguage] = useState("");

    // Debounce Search Term
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 150); // 150ms delay
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Initial Fetch (Real-time, All Songs)
    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
                return;
            }

            setFetching(true);
            const q = query(collection(db, "music_sheets"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSongs(data);
                setFetching(false);
            });
            return () => unsubscribe();
        }
    }, [user, loading, router]);


    // Client-Side Filtering & Sorting
    useEffect(() => {
        let results = songs;

        // 1. Apply Filters
        if (filterKey) {
            results = results.filter(s => s.songKey === filterKey);
        }

        if (filterLanguage) {
            results = results.filter(s => s.songLanguage === filterLanguage);
        }

        if (filterCategory) {
            results = results.filter(s => {
                if (Array.isArray(s.songCategory)) {
                    return s.songCategory.includes(filterCategory);
                }
                return s.songCategory === filterCategory;
            });
        }

        // 2. Search (Infix/Substring)
        if (debouncedSearchTerm) {
            const lower = debouncedSearchTerm.toLowerCase();
            results = results
                .filter(s =>
                    s.songName.toLowerCase().includes(lower) ||
                    (s.songArtist && s.songArtist.toLowerCase().includes(lower))
                )
                .sort((a, b) => {
                    const getScore = (item: any) => {
                        const name = item.songName.toLowerCase();
                        const artist = (item.songArtist || "").toLowerCase();

                        if (name.startsWith(lower)) return 1;
                        if (name.includes(lower)) return 2;
                        if (artist.startsWith(lower)) return 3;
                        if (artist.includes(lower)) return 4;
                        return 5;
                    };

                    const scoreA = getScore(a);
                    const scoreB = getScore(b);

                    // 1. Sort by score first (relevance)
                    if (scoreA !== scoreB) {
                        return scoreA - scoreB;
                    }

                    // 2. If scores are tied, sort alphabetically
                    return a.songName.toLowerCase().localeCompare(b.songName.toLowerCase());
                });
        }

        setFilteredSongs(results);
    }, [songs, debouncedSearchTerm, filterKey, filterCategory, filterLanguage]);

    // Removed client-side filtering effect since we do it server-side now
    // Only sort by relevance if needed? 
    // Effect handles fetching.


    const showHomeView = !searchTerm && !filterKey && !filterCategory && !filterLanguage;
    const recentViewedSongs = recentViewedIds
        .map(id => songs.find(s => s.id === id))
        .filter(Boolean);
    const newArrivals = songs.slice(0, 5);

    // URL State Management
    const searchParams = useSearchParams();
    const pathname = usePathname();

    useEffect(() => {
        const songId = searchParams.get("songId");
        if (songId) {
            // Find song in current list or fetch if not found (though finding in list is usually enough for this flow)
            // Note: If songs are not loaded yet, this might need to wait for songs. 
            // However, since we sync with `songs` or `filteredSongs`, we can check there.
            const song = songs.find(s => s.id === songId);
            if (song) {
                setSelectedSong(song);
            }
        } else {
            setSelectedSong(null);
            setIsEditing(false); // Close editing if modal closes
        }
    }, [searchParams, songs]);


    const handleSongClick = (song: any) => {
        // Push state to URL
        const params = new URLSearchParams(searchParams.toString());
        params.set("songId", song.id);

        // Add current scroll position to restore later? (Browser handles this mostly)
        addToRecentViewed(song.id);
        if (searchTerm) addToRecentSearches(searchTerm);

        router.push(`${pathname}?${params.toString()}`);
    };

    if (loading || !user) return null;

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>악보 라이브러리</h1>

            {/* Filter Bar */}
            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchInputContainer}>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="곡 제목 또는 아티스트 검색..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') addToRecentSearches(searchTerm);
                        }}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                searchInputRef.current?.focus();
                            }}
                            className={styles.clearButton}
                        >
                            <FaTimes />
                        </button>
                    )}
                </div>

                <div className={styles.filterBarSelectContainer}>
                    <select
                        className={styles.filterSelect}
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                    >
                        <option value="">모든 카테고리</option>
                        <option value="상향">상향</option>
                        <option value="외향">외향</option>
                        <option value="내향">내향</option>
                        <option value="JOY">JOY</option>
                    </select>
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
                        value={filterLanguage}
                        onChange={e => setFilterLanguage(e.target.value)}
                    >
                        <option value="">모든 언어</option>
                        <option value="한국어">한국어</option>
                        <option value="영어">영어</option>
                        <option value="아랍어">아랍어</option>
                        <option value="터키어">터키어</option>
                    </select>
                </div>
            </div>

            <div className={styles.grid}>
                {showHomeView ? (
                    <div className={styles.homeView}>

                        {/* 1. Recently Viewed */}
                        {recentViewedSongs.length > 0 && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>
                                    <span>🕒</span> 최근 본 악보
                                </h2>
                                <div className={styles.horizontalScroll}>
                                    {recentViewedSongs.map(song => (
                                        <SongCard key={song.id} song={song} onClick={() => handleSongClick(song)} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 2. New Arrivals */}
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>
                                <span>✨</span> 새로 올라온 악보
                            </h2>
                            <div className={styles.grid}>
                                {newArrivals.map(song => (
                                    <SongCard key={song.id} song={song} onClick={() => handleSongClick(song)} isNew />
                                ))}
                            </div>
                        </section>
                    </div>
                ) : (
                    <>
                        {filteredSongs.length === 0 && !fetching && (
                            <div className={styles.emptyState}>
                                <p>검색 결과가 없습니다.</p>
                            </div>
                        )}
                        {filteredSongs.map((song) => (
                            <SongCard key={song.id} song={song} onClick={() => handleSongClick(song)} />
                        ))}
                    </>
                )}
            </div>



            <AnimatePresence>
                {selectedSong && (
                    <SongViewer
                        modalSong={selectedSong}
                        onClose={() => router.back()}
                        startEditing={startEditing}
                        isEditing={isEditing}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        handleSave={handleSave}
                        handleDelete={handleDelete}
                        setIsEditing={setIsEditing}
                        isManager={isManager}
                        songList={filteredSongs}
                        onNavigate={(song: any) => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("songId", song.id);
                            router.replace(`?${params.toString()}`);
                        }}
                        handleCreateSet={(songId: string) => {
                            const queryParams = new URLSearchParams();
                            queryParams.set("songId", songId);
                            if (searchTerm) queryParams.set("q", searchTerm);
                            if (filterKey) queryParams.set("key", filterKey);
                            if (filterLanguage) queryParams.set("lang", filterLanguage);
                            if (filterCategory) queryParams.set("cat", filterCategory);
                            router.push(`/dashboard/setlists/new?${queryParams.toString()}`);
                        }}
                    />
                )}
            </AnimatePresence>
        </div >
    );
}

// Sub-component for clean rendering
function SongCard({ song, onClick, isNew }: { song: any, onClick: () => void, isNew?: boolean }) {
    return (
        <div className={styles.songCard} onClick={onClick}>
            <div className={styles.cardContent}>
                <div className={styles.songName}>
                    {song.songName}
                    {isNew && <span className={styles.newBadge}>NEW</span>}
                </div>
                <div className={styles.songMeta}>
                    <span>{song.songArtist}</span>
                    <span className={styles.keyBadge}>{song.songKey}</span>
                </div>
            </div>
        </div>
    );
}
