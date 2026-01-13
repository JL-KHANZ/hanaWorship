"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes, FaPen, FaSave } from "react-icons/fa";
import { doc, updateDoc } from "firebase/firestore";

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
        songLanguage: ""
    });

    const startEditing = () => {
        if (!selectedSong) return;
        setEditForm({
            songName: selectedSong.songName || "",
            songArtist: selectedSong.songArtist || "",
            songKey: selectedSong.songKey || "",
            songLanguage: selectedSong.songLanguage || "한국어"
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
                songLanguage: editForm.songLanguage
            });
            // Local update (optional, as snapshot listener will handle it)
            setSelectedSong({ ...selectedSong, ...editForm });
            setIsEditing(false);
        } catch (e) {
            console.error("Update failed", e);
            alert("수정 실패");
        }
    };

    // Filter States
    const [searchTerm, setSearchTerm] = useState("");
    const [filterKey, setFilterKey] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [filterLanguage, setFilterLanguage] = useState("");

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

        if (filterLanguage) {
            results = results.filter(s => s.songLanguage === filterLanguage);
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
    }, [searchTerm, filterKey, filterCategory, filterLanguage, songs]);

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
                    value={filterLanguage}
                    onChange={e => setFilterLanguage(e.target.value)}
                >
                    <option value="">모든 언어</option>
                    <option value="한국어">한국어</option>
                    <option value="영어">영어</option>
                    <option value="아랍어">아랍어</option>
                    <option value="터키어">터키어</option>
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
                    <div
                        key={song.id}
                        className={styles.songCard}
                        onClick={() => setSelectedSong(song)}
                        style={{ cursor: "pointer" }}
                    >

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

            <AnimatePresence>
                {selectedSong && (
                    <SongViewer
                        modalSong={selectedSong}
                        onClose={() => setSelectedSong(null)}
                        startEditing={startEditing}
                        isEditing={isEditing}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        handleSave={handleSave}
                        setIsEditing={setIsEditing}
                        isManager={isManager}
                        songList={filteredSongs}
                        onNavigate={(song: any) => setSelectedSong(song)}
                    />
                )}
            </AnimatePresence>
        </div >
    );
}

// Extracted Component for cleanliness
function SongViewer({ modalSong, onClose, startEditing, isEditing, editForm, setEditForm, handleSave, setIsEditing, isManager, songList, onNavigate }: any) {
    const [showControls, setShowControls] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);

    // Determine available pages
    const pages = modalSong.pages && modalSong.pages.length > 0 ? modalSong.pages : [modalSong.imageUrl];
    const hasMultiplePages = pages.length > 1;

    // Reset page when song changes
    useEffect(() => {
        setCurrentPage(0);
    }, [modalSong.id]);

    // Reset edit mode on close
    const handleClose = () => {
        setIsEditing(false);
        onClose();
    };

    const toggleControls = () => {
        if (!isEditing) {
            setShowControls(prev => !prev);
        }
    };

    const currentIndex = songList?.findIndex((s: any) => s.id === modalSong.id) ?? -1;
    const hasNextSong = currentIndex !== -1 && currentIndex < songList.length - 1;
    const hasPrevSong = currentIndex !== -1 && currentIndex > 0;

    const nextPage = (e?: any) => {
        e?.stopPropagation();
        if (currentPage < pages.length - 1) {
            // Next Page
            setCurrentPage(prev => prev + 1);
        } else if (hasNextSong) {
            // Next Song
            onNavigate(songList[currentIndex + 1]);
        }
    };

    const prevPage = (e?: any) => {
        e?.stopPropagation();
        if (currentPage > 0) {
            // Prev Page
            setCurrentPage(prev => prev - 1);
        } else if (hasPrevSong) {
            // Prev Song
            onNavigate(songList[currentIndex - 1]);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.viewerOverlay}
            onClick={toggleControls}
            drag // Allow drag in both directions
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
                const swipeThreshold = 50;
                // Horizontal Swipe (Page Change)
                if (Math.abs(offset.x) > Math.abs(offset.y) && Math.abs(offset.x) > swipeThreshold) {
                    if (offset.x < 0) nextPage(); // Swipe Left -> Next
                    else prevPage(); // Swipe Right -> Prev
                }
                // Vertical Swipe (Close)
                else if (offset.y > swipeThreshold || velocity.y > 100) {
                    handleClose();
                }
            }}
        >
            {/* Image Container */}
            <div className={styles.viewerImageContainer}>
                {pages[currentPage] ? (
                    <img
                        key={currentPage} // Force re-render for animation if needed, or simply switch src
                        src={pages[currentPage]}
                        alt={`${modalSong.songName} - Page ${currentPage + 1}`}
                        className={`${styles.viewerImage} ${isEditing ? 'opacity-10 grayscale blur-sm transition-all duration-300' : 'transition-all duration-300'}`}
                    />
                ) : (
                    <div className={styles.modalFallback}>
                        이미지가 없습니다
                    </div>
                )}
            </div>

            {/* Top Bar */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className={styles.viewerTopBar}
                        onClick={e => e.stopPropagation()}
                    >
                        <button onClick={handleClose} className={styles.viewerCloseBtn}>
                            <FaTimes />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Bar */}
            <AnimatePresence>
                {(showControls || isEditing) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className={styles.viewerBottomBar}
                        onClick={e => isEditing && e.stopPropagation()} // Stop propagation only if editing to prevent toggle
                    >
                        {isEditing ? (
                            <div className="flex flex-col gap-2 p-6 bg-zinc-900 rounded-xl shadow-2xl border border-white/10 w-full max-w-md" onClick={e => e.stopPropagation()}>
                                <h3 className="text-white font-bold mb-2">악보 정보 수정</h3>
                                <input
                                    className={styles.editInput}
                                    value={editForm.songName}
                                    onChange={e => setEditForm({ ...editForm, songName: e.target.value })}
                                    placeholder="곡 제목"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <input
                                        className={styles.editInput}
                                        style={{ width: '80px' }}
                                        value={editForm.songKey}
                                        onChange={e => setEditForm({ ...editForm, songKey: e.target.value })}
                                        placeholder="Key"
                                    />
                                    <input
                                        className={styles.editInput}
                                        style={{ flex: 1 }}
                                        value={editForm.songArtist}
                                        onChange={e => setEditForm({ ...editForm, songArtist: e.target.value })}
                                        placeholder="아티스트"
                                    />
                                </div>
                                <div className="mt-2">
                                    <select
                                        className={styles.editInput}
                                        value={editForm.songLanguage}
                                        onChange={e => setEditForm({ ...editForm, songLanguage: e.target.value })}
                                    >
                                        <option value="한국어">한국어</option>
                                        <option value="영어">영어</option>
                                        <option value="아랍어">아랍어</option>
                                        <option value="터키어">터키어</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 justify-end mt-4">
                                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm bg-white/10 rounded hover:bg-white/20 text-white transition-colors">취소</button>
                                    <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 rounded hover:bg-blue-500 flex items-center gap-2 text-white font-medium transition-colors">
                                        <FaSave /> 저장하기
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center" onClick={e => e.stopPropagation()}>
                                <div className={styles.viewerTitle}>
                                    {modalSong.songName} {modalSong.songKey}

                                    {isManager && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEditing(); }}
                                            className="opacity-50 hover:opacity-100 transition-opacity p-2 text-white hover:text-blue-400 text-sm"
                                            title="수정하기"
                                        >
                                            <FaPen />
                                        </button>
                                    )}
                                </div>
                                <div className={styles.viewerSubtitle}>
                                    {modalSong.songArtist}
                                    {/* Page Indicator */}
                                    <span>
                                        {currentPage + 1} / {pages.length}
                                    </span>

                                    {/* {modalSong.songLanguage && (
                                        <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded text-white/70 align-middle">
                                            {modalSong.songLanguage}
                                        </span>
                                    )} */}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
